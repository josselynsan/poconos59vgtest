/* ============================================================
   upgrades-v5 — Google Places autocomplete for the billing address
   ------------------------------------------------------------
   Typing in #billing_address queries Google, picking a suggestion
   fills #billing_address / #billing_city / #state / #zip / #country.

   WHY THE DATA API AND NOT A GOOGLE WIDGET
   Two Google-supplied alternatives were rejected on purpose:

     * `google.maps.places.Autocomplete` (the classic widget) is in
       Legacy status and needs "Places API" — the legacy service,
       which cannot be enabled on Cloud projects created after
       2025-03-01. A key from a fresh project would silently fail.
     * `PlaceAutocompleteElement` renders its own <input> inside a
       shadow root. #billing_address is a contract: integration_step3.js
       reads and prefills `input[name="address"]`, and jquery.validate
       is bound to it. Replacing it means a hidden mirror field plus a
       sync loop.

   The Autocomplete DATA API (`AutocompleteSuggestion`) is the current,
   GA surface and returns plain data, so the flow keeps its own input,
   its own markup and its own styling. The dropdown below is ours.

   DEGRADATION
   Everything here is additive. No key, blocked maps.googleapis.com,
   quota exhausted, API error — the field stays a normal text input and
   the form submits exactly as it does in upgrades-v4. Nothing gates the
   submit on having picked a suggestion, and the input is never readonly.

   Config comes from window.pfAddressAutocomplete, emitted by step3.php.
   Entry point: window.pfInitAddressAutocomplete — the `callback=` target
   of the Maps bootstrap script.
   ============================================================ */
(function () {
  "use strict";

  var CFG = window.pfAddressAutocomplete || {};

  var els = {};
  var places = null;         // google.maps.places
  var token = null;          // AutocompleteSessionToken
  var suggestions = [];      // current predictions
  var activeIndex = -1;
  var seq = 0;               // request sequence, to drop stale responses
  var debounceId = null;
  var lastQuery = "";
  var typesRejected = false; // set once includedPrimaryTypes proves invalid
  var listEl = null;

  /* Country codes arrive from CMS values an operator types, so they can be
     "US", "us , ca " or a real array. Normalise rather than trust. */
  function regionList(raw) {
    if (!raw) return [];
    if (typeof raw === "string") raw = raw.split(",");
    if (!Array.isArray(raw)) return [];
    return raw.map(function (c) { return String(c).trim().toUpperCase(); })
              .filter(function (c) { return /^[A-Z]{2}$/.test(c); });
  }

  // Optional hard allow-list. Empty unless an offer sets one.
  var LOCKED_REGIONS = regionList(CFG.countries);
  // The offer's own billing country, rendered server-side — always known.
  var OFFER_REGIONS = regionList(CFG.offerCountry);

  var MIN_CHARS = parseInt(CFG.minChars, 10) > 0 ? parseInt(CFG.minChars, 10) : 3;
  var DEBOUNCE = 250;
  var LIST_ID = "pf-ac-list";

  /* ---------- small helpers ---------- */

  function byId(id) { return document.getElementById(id); }

  function text(v) { return (v === null || v === undefined) ? "" : String(v); }

  /* Prediction text arrives as a FormattableText ({ text, matches }), but a
     bare string is just as plausible per the reference, so accept either.
     Guessing wrong here renders every suggestion as an empty row, with no
     error anywhere to explain it. */
  function ftext(v) {
    if (!v) return "";
    return typeof v === "string" ? v : text(v.text);
  }

  /* The JS API exposes mainText/secondaryText on PlacePrediction directly; the
     REST payload for the same prediction nests them one level down, under
     structuredFormat — verified against a live places:autocomplete response.
     Read whichever this SDK build hands us. */
  function predictionPart(p, part) {
    if (!p) return "";
    var flat = ftext(p[part]);
    if (flat) return flat;
    return p.structuredFormat ? ftext(p.structuredFormat[part]) : "";
  }

  /* jquery.mask reformats on input, and jquery.validate only re-checks a
     field on its own events — a bare `.value =` is invisible to both. Fire
     input+change so the mask reprocesses and the validator can clear a
     stale error. These are synthetic events (isTrusted === false), which is
     exactly what onInput() filters on, so this cannot re-open the dropdown. */
  function setValue(el, value) {
    if (!el) return;
    el.value = value;
    if (window.jQuery) {
      window.jQuery(el).trigger("input").trigger("change");
    } else {
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
    revalidate(el);
  }

  /* Clear an error the guest has already been shown, now that we filled the
     field. Only ever called with a non-empty value, so .valid() can only
     clear — it can never light up a field the guest hasn't reached yet. */
  function revalidate(el) {
    if (!window.jQuery || !el || !el.value) return;
    var $el = window.jQuery(el);
    var $form = $el.closest("form");
    if (!$form.length || !$form.data("validator")) return;
    try { $el.valid(); } catch (e) {}
  }

  /* ---------- dropdown ---------- */

  function buildList() {
    var wrap = document.createElement("div");
    wrap.className = "pf-ac";

    var input = els.address;
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    listEl = document.createElement("ul");
    listEl.className = "pf-ac__list";
    listEl.id = LIST_ID;
    listEl.setAttribute("role", "listbox");
    listEl.hidden = true;
    wrap.appendChild(listEl);

    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", LIST_ID);
    /* The browser's own address autofill dropdown would stack on top of
       ours. Google's samples turn it off for the same reason; the guest
       still gets suggestions, just from one source. */
    input.setAttribute("autocomplete", "off");
  }

  function isOpen() { return listEl && !listEl.hidden; }

  function closeList() {
    if (!listEl) return;
    listEl.hidden = true;
    listEl.innerHTML = "";
    els.address.setAttribute("aria-expanded", "false");
    els.address.removeAttribute("aria-activedescendant");
    suggestions = [];
    activeIndex = -1;
  }

  function renderList(items) {
    suggestions = items;
    activeIndex = -1;
    listEl.innerHTML = "";

    if (!items.length) { closeList(); return; }

    items.forEach(function (item, i) {
      var p = item.placePrediction;
      var li = document.createElement("li");
      li.className = "pf-ac__item";
      li.id = "pf-ac-opt-" + i;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", "false");

      var main = document.createElement("span");
      main.className = "pf-ac__main";
      main.textContent = predictionPart(p, "mainText") || ftext(p.text);

      var sub = document.createElement("span");
      sub.className = "pf-ac__sub";
      sub.textContent = predictionPart(p, "secondaryText");

      li.appendChild(main);
      if (sub.textContent) li.appendChild(sub);

      /* mousedown, not click: the input's blur fires first on click and
         would have closed the list before the click ever landed. */
      li.addEventListener("mousedown", function (e) {
        e.preventDefault();
        choose(i);
      });
      li.addEventListener("mouseenter", function () { setActive(i); });

      listEl.appendChild(li);
    });

    listEl.hidden = false;
    els.address.setAttribute("aria-expanded", "true");
  }

  function setActive(i) {
    var items = listEl.children;
    if (activeIndex > -1 && items[activeIndex]) {
      items[activeIndex].classList.remove("is-active");
      items[activeIndex].setAttribute("aria-selected", "false");
    }
    activeIndex = i;
    if (i > -1 && items[i]) {
      items[i].classList.add("is-active");
      items[i].setAttribute("aria-selected", "true");
      els.address.setAttribute("aria-activedescendant", items[i].id);
      if (items[i].scrollIntoView) items[i].scrollIntoView({ block: "nearest" });
    } else {
      els.address.removeAttribute("aria-activedescendant");
    }
  }

  /* ---------- Google calls ---------- */

  function newToken() {
    try { token = new places.AutocompleteSessionToken(); } catch (e) { token = null; }
  }

  /* Which countries Google may suggest from — resolved per request, in order:

       1. an offer's explicit allow-list, if it set one (hard lock);
       2. whatever is selected in #country — the guest's own answer, and for
          a MX or CA promotion the value the offer preselected there;
       3. the offer's billing country as rendered server-side.

     Step 3 is what makes step 2 safe. #country has no <option>s at all until
     BindCountryStatesDropdowns' $.getJSON of countries.json returns, and that
     is bound on window.load — reading the select alone means a guest typing in
     that first moment gets an unrestricted, worldwide search. The server-side
     value covers exactly that window, so the funnel is never wider than the
     country it sells to, and never narrower than what the guest picked.

     There is deliberately NO geo-IP input here. `Hookier.userIPInfo` exists
     (common.js uses it to preselect the state), but where a guest is sitting
     is not where their card is billed — VPNs, travel and snowbirds all break
     it, and restricting on it would hide the address someone is trying to
     type. The offer's configured country is a far stronger signal for a funnel
     that sells to one market. */
  function currentRegionCodes() {
    if (LOCKED_REGIONS.length) return LOCKED_REGIONS;

    var picked = els.country && els.country.value
      ? regionList(els.country.value)
      : [];
    if (picked.length) return picked;

    return OFFER_REGIONS.length ? OFFER_REGIONS : null;
  }

  function fetchSuggestions(query, mySeq) {
    var req = { input: query };
    if (token) req.sessionToken = token;
    if (CFG.language) req.language = CFG.language;
    if (CFG.region) req.region = CFG.region;

    var regions = currentRegionCodes();
    if (regions) req.includedRegionCodes = regions;

    /* The exact enum accepted by includedPrimaryTypes is not something we
       want to bet the feature on: one wrong value is an INVALID_ARGUMENT
       that kills every lookup. Ask with the filter, and on any rejection
       retry once unfiltered and remember not to send it again. Unfiltered
       results include businesses, which still resolve to a real address. */
    if (!typesRejected && CFG.primaryTypes && CFG.primaryTypes.length) {
      req.includedPrimaryTypes = CFG.primaryTypes;
    }

    places.AutocompleteSuggestion.fetchAutocompleteSuggestions(req)
      .then(function (res) {
        if (mySeq !== seq) return;   // a newer keystroke already went out
        renderList((res && res.suggestions) || []);
      })
      .catch(function () {
        if (req.includedPrimaryTypes) {
          typesRejected = true;
          delete req.includedPrimaryTypes;
          places.AutocompleteSuggestion.fetchAutocompleteSuggestions(req)
            .then(function (res) {
              if (mySeq !== seq) return;
              renderList((res && res.suggestions) || []);
            })
            .catch(function () { if (mySeq === seq) closeList(); });
          return;
        }
        if (mySeq === seq) closeList();
      });
  }

  function choose(i) {
    var item = suggestions[i];
    if (!item || !item.placePrediction) return;

    var prediction = item.placePrediction;
    var mainText = predictionPart(prediction, "mainText") || ftext(prediction.text);

    /* Put the street line in straight away. fetchFields is a network round
       trip; without this the field reads as cleared for a moment right
       after the guest clicked something. */
    if (mainText) setValue(els.address, mainText);
    closeList();

    var place;
    try { place = prediction.toPlace(); } catch (e) { return; }

    place.fetchFields({ fields: ["addressComponents", "formattedAddress"] })
      .then(function () {
        /* fetchFields spends the session token — Google bills the next
           keystroke as a new session, so start one. */
        newToken();
        fill(place, mainText);
      })
      .catch(function () {
        // Details lookup failed; the street line above is still in the field.
        newToken();
      });
  }

  /* ---------- filling the form ---------- */

  /* addressComponents is an array of { longText, shortText, types[] }.
     Index it by type so lookups read like the form they populate. */
  function indexComponents(place) {
    var map = {};
    var list = (place && place.addressComponents) || [];
    list.forEach(function (c) {
      /* longText/shortText in the JS API, long_name/short_name in the REST
         payload and in the legacy geocoder result. Reading both means a shape
         change cannot silently blank every field on the form. */
      var long  = c.longText  !== undefined ? c.longText  : c.long_name;
      var short = c.shortText !== undefined ? c.shortText : c.short_name;
      (c.types || []).forEach(function (t) {
        if (!map[t]) map[t] = { long: text(long), short: text(short !== undefined ? short : long) };
      });
    });
    return map;
  }

  function pick(map, keys, which) {
    for (var i = 0; i < keys.length; i++) {
      var c = map[keys[i]];
      if (c && c[which]) return c[which];
    }
    return "";
  }

  function fill(place, fallbackStreet) {
    var c = indexComponents(place);

    // Street line: number + route, with the coarser containers as fallbacks
    // (a named building, an apartment block, a rural route).
    var number = pick(c, ["street_number"], "long");
    var street = [number, pick(c, ["route"], "long")].filter(Boolean).join(" ");
    if (!street) street = pick(c, ["premise", "subpremise", "establishment", "point_of_interest"], "long");
    if (!street) street = fallbackStreet;

    /* `route` is one of the primary types we ask for, so a suggestion can
       resolve to the street itself rather than an address on it. Google then
       returns a route component and NO street_number, even though the line it
       displayed — and the guest clicked — still carried the number:

         "301 Front St W, Toronto"  ->  route "Front Street West", no number

       Rebuilding from components alone would drop the house number silently,
       and the card fails AVS on an address the guest believes they picked.
       The prediction's own label is the only place the number survives, so
       prefer it whenever the components came back without one. Taken whole
       rather than spliced onto the route: Mexico writes the number last
       ("Av. P.º de la Reforma 222"), so there is no leading-number rule that
       holds everywhere. */
    if (!number && fallbackStreet && /\d/.test(fallbackStreet)) street = fallbackStreet;

    if (street) setValue(els.address, street);

    // City. Google's answer for "the city" differs by country: locality in
    // the US, postal_town in the UK, sublocality in parts of Asia.
    var city = pick(c, [
      "locality",
      "postal_town",
      "sublocality_level_1",
      "sublocality",
      "administrative_area_level_3",
      "administrative_area_level_2",
      "neighborhood"
    ], "long");
    if (city) setValue(els.city, city);

    setZip(pick(c, ["postal_code"], "long"), pick(c, ["country"], "short"));

    // Country/state last: this can rebuild the state <select>, so it must not
    // race the plain text fields above.
    setCountryAndState(pick(c, ["country"], "short"), c);
  }

  /* #zip carries a five-digit mask (`$("#zip").mask("00000")` in
     js/common.js), so a ZIP+4 like "12345-6789" gets mangled. Keep the base
     code for US-style keys and pass anything else through — Canadian and UK
     postcodes are alphanumeric and unmasked. */
  function setZip(zip, countryShort) {
    if (!zip || !els.zip) return;
    if (countryShort === "US") zip = zip.split("-")[0].replace(/\D/g, "").slice(0, 5);
    setValue(els.zip, zip);
  }

  function hasOption(select, value) {
    return !!(select && value && select.querySelector('option[value="' + String(value).replace(/"/g, '\\"') + '"]'));
  }

  function setCountryAndState(countryShort, components) {
    // administrative_area_level_1 short_name is the two-letter code the
    // state <select> is keyed on (countries.json stores `abbreviation`).
    var stateShort = pick(components, ["administrative_area_level_1"], "short");

    var countryChanged = false;
    if (countryShort && els.country && hasOption(els.country, countryShort) && els.country.value !== countryShort) {
      /* Only on a real difference. The default is US and US billing is the
         overwhelming case, so normally we never touch #country — and never
         set off the two change handlers (step3.php's and common.js's own)
         that each rebuild the state list from countries.json. */
      els.country.value = countryShort;
      if (window.jQuery) window.jQuery(els.country).trigger("change");
      else els.country.dispatchEvent(new Event("change", { bubbles: true }));
      countryChanged = true;
    }

    if (!stateShort || !els.state) return;

    if (!countryChanged) {
      if (hasOption(els.state, stateShort)) setValue(els.state, stateShort);
      return;
    }

    /* A country change rebuilds the state list from an async $.getJSON, so
       the option we want does not exist yet. Poll for it, then re-assert:
       BindSatesDropdownByCountry (common/js/common.js) runs its own
       `setTimeout(…, 500)` that overwrites the selection with the geo-IP
       region or the first option, and that timer starts when the rebuild
       does — after ours. Re-asserting past it is what makes the pick stick. */
    waitForOption(els.state, stateShort, 3000, function (found) {
      if (!found) return;
      setValue(els.state, stateShort);
      [600, 1100].forEach(function (delay) {
        window.setTimeout(function () {
          if (els.state.value !== stateShort && hasOption(els.state, stateShort)) {
            setValue(els.state, stateShort);
          }
        }, delay);
      });
    });
  }

  function waitForOption(select, value, timeout, done) {
    var started = Date.now();
    (function poll() {
      if (hasOption(select, value)) return done(true);
      if (Date.now() - started > timeout) return done(false);
      window.setTimeout(poll, 100);
    })();
  }

  /* ---------- input events ---------- */

  function onInput(e) {
    /* integration_step3.js prefills this form from the lead object, and in
       tester mode it writes a literal test address — both after this script
       has bound. jQuery's .val() + .trigger() and our own setValue() produce
       synthetic events; only a human keystroke, paste or IME commit is
       trusted. Without this check the page opens with a dropdown hanging
       under a field nobody touched, and each prefill costs a billed request. */
    if (!e.isTrusted) return;

    var q = els.address.value.trim();
    if (q === lastQuery) return;
    lastQuery = q;

    window.clearTimeout(debounceId);

    if (q.length < MIN_CHARS) { seq++; closeList(); return; }

    debounceId = window.setTimeout(function () {
      var mySeq = ++seq;
      fetchSuggestions(q, mySeq);
    }, DEBOUNCE);
  }

  function onKeyDown(e) {
    if (!isOpen()) {
      // ArrowDown on a field that already has enough text re-opens the last
      // result set rather than making the guest edit the value to get it back.
      if (e.key === "ArrowDown" && els.address.value.trim().length >= MIN_CHARS) {
        lastQuery = "";
        onInput({ isTrusted: true });
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((activeIndex + 1) % suggestions.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive(activeIndex <= 0 ? suggestions.length - 1 : activeIndex - 1);
        break;
      case "Enter":
        // Critical: an open list means Enter picks a suggestion. Letting it
        // through would submit the payment form instead.
        if (activeIndex > -1) {
          e.preventDefault();
          choose(activeIndex);
        } else {
          closeList();
        }
        break;
      case "Escape":
        e.preventDefault();
        closeList();
        break;
      case "Tab":
        closeList();
        break;
    }
  }

  /* ---------- boot ---------- */

  function ready() {
    // Prefer billing_* ids (this funnel's billing-information.html); fall back
    // to the shorter ids used by older step3 templates.
    els.address = byId("billing_address") || byId("address");
    els.city    = byId("billing_city") || byId("city");
    els.state   = byId("billing_state") || byId("state");
    els.zip     = byId("billing_zip") || byId("zip");
    els.country = byId("billing_country") || byId("country");

    if (!els.address) return false;
    if (!window.google || !window.google.maps || !window.google.maps.places) return false;

    places = window.google.maps.places;
    if (!places.AutocompleteSuggestion || !places.AutocompleteSessionToken) return false;
    return true;
  }

  window.pfInitAddressAutocomplete = function () {
    if (listEl) return;          // Maps calls the callback once; be safe anyway
    if (!ready()) {
      var why = !(byId("billing_address") || byId("address"))
        ? "missing #billing_address"
        : !(window.google && window.google.maps && window.google.maps.places)
          ? "google.maps.places not loaded (API key / referrer / network)"
          : "AutocompleteSuggestion unavailable — enable Places API (New)";
      if (typeof console !== "undefined" && console.warn) {
        console.warn("[pf-address-autocomplete] init skipped:", why);
      }
      return;
    }

    newToken();
    buildList();

    els.address.addEventListener("input", onInput);
    els.address.addEventListener("keydown", onKeyDown);
    els.address.addEventListener("blur", function () {
      // After the pointer-down handler on an item has had its turn.
      window.setTimeout(closeList, 120);
    });
    document.addEventListener("click", function (e) {
      if (listEl && !listEl.hidden && !listEl.parentNode.contains(e.target)) closeList();
    });

    /* A country switch invalidates the suggestion list: it is region-scoped
       through includedRegionCodes. */
    if (els.country) {
      els.country.addEventListener("change", function () { closeList(); lastQuery = ""; });
    }

    if (typeof console !== "undefined" && console.info) {
      console.info("[pf-address-autocomplete] ready on", location.host);
    }
  };
})();
