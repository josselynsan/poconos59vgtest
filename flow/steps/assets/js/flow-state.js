/* ============================================================
   Flow State + Handoff Seam
   ------------------------------------------------------------
   This is the seam between the two packages (homepage + this
   payment flow). The flow ALWAYS works standalone because the
   default Massanutten offer is baked in below. When the
   homepage hands off, it can override any of these values via
   URL query params (?pkg=...&price=...) or by writing to
   localStorage key "pf_order" before redirecting here.
   ============================================================ */
(function (global) {
  "use strict";

  var STORAGE_KEY = "pf_order";

  // --- Baked-in defaults (the Pigeon Forge / Smoky Mountains package) -----------
  var DEFAULTS = {
    packageId: "vg-pigeonforge-4-3-59",
    resortName: "Country Inn & Suites by Radisson",
    stayLabel: "4-Days / 3-Nights",
    roomLabel: "Spacious Room",
    retailCents: 107900, // $1,079
    priceCents: 5900, // $59
    bookingFeeCents: 0,
    discountPct: 95,
    ratingReviews: 4850,
    // holds are display-only urgency; not a real inventory lock
    holdMinutes: 10,
    // per-family pricing model
    perLabel: "Per Family of Four",
    // CR-08: single source of truth for guest wording — must match the
    // landing page for the traffic source (overridable via ?guests=...)
    guestsLabel: "2 Adults, 2 Children",
    // guest + dates get filled in as the user progresses
    guest: { firstName: "", lastName: "", email: "", phone: "" },
    consent: { marketing: false, sms: true },
    nights: 3, // fixed stay length for this package (check-out auto-locks to check-in + nights)
    dates: { checkIn: null, checkOut: null },
    upsells: [], // { type, qty, priceCents }
    decided: [], // upsell types the guest has already been offered (added OR declined)
    status: "order_details"
  };

  function readQueryOverrides() {
    var out = {};
    try {
      var q = new URLSearchParams(global.location.search);
      if (q.get("price")) out.priceCents = parseInt(q.get("price"), 10);
      if (q.get("retail")) out.retailCents = parseInt(q.get("retail"), 10);
      if (q.get("pct")) out.discountPct = parseInt(q.get("pct"), 10);
      if (q.get("pkg")) out.packageId = q.get("pkg");
      if (q.get("resort")) out.resortName = q.get("resort");
      if (q.get("guests")) out.guestsLabel = q.get("guests");
    } catch (e) {}
    return out;
  }

  // Offer admin → package_summary_json injected as SWIFTLY_OFFER_FLOW.packageSummary
  function packageSummaryOverrides() {
    var out = {};
    try {
      var flow = global.SWIFTLY_OFFER_FLOW || {};
      var pkg = flow.packageSummary || flow.package_summary_json || {};
      if (!pkg || typeof pkg !== "object") return out;
      var strKeys = ["resortName", "stayLabel", "roomLabel", "perLabel", "guestsLabel", "packageId"];
      for (var i = 0; i < strKeys.length; i++) {
        var sk = strKeys[i];
        if (pkg[sk] != null && String(pkg[sk]).trim() !== "") out[sk] = String(pkg[sk]);
      }
      var numKeys = ["bookingFeeCents", "discountPct", "ratingReviews", "holdMinutes", "priceCents", "retailCents", "nights"];
      for (var j = 0; j < numKeys.length; j++) {
        var nk = numKeys[j];
        if (pkg[nk] === null || pkg[nk] === undefined || pkg[nk] === "") continue;
        var n = Number(pkg[nk]);
        if (!isNaN(n)) out[nk] = n;
      }
    } catch (e) {}
    return out;
  }

  function load() {
    var saved = {};
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (raw) saved = JSON.parse(raw) || {};
    } catch (e) {}
    // merge order: defaults <- localStorage <- offer packageSummary <- query
    // packageSummary wins over stale pf_order so admin Package Summary is authoritative.
    var state = Object.assign({}, DEFAULTS, saved, packageSummaryOverrides(), readQueryOverrides());
    // deep-ish restore for nested objects
    state.guest = Object.assign({}, DEFAULTS.guest, saved.guest);
    state.consent = Object.assign({}, DEFAULTS.consent, saved.consent);
    state.dates = Object.assign({}, DEFAULTS.dates, saved.dates);
    state.upsells = saved.upsells || [];
    state.decided = saved.decided || [];
    return state;
  }

  var state = load();

  var FlowState = {
    get: function () { return state; },
    /** shallow-merge a patch and persist */
    set: function (patch) {
      Object.assign(state, patch);
      this.save();
      return state;
    },
    /** merge into a nested object (guest/consent/dates) and persist */
    setIn: function (key, patch) {
      state[key] = Object.assign({}, state[key], patch);
      this.save();
      return state;
    },
    save: function () {
      try { global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
    },
    reset: function () {
      try { global.localStorage.removeItem(STORAGE_KEY); } catch (e) {}
      state = load();
      return state;
    },
    // --- formatting helpers ---
    money: function (cents) {
      return "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },
    /** Reservation-hold deadline shared across steps so a refresh doesn't reset the countdown. */
    holdDeadline: function () {
      var now = Date.now();
      if (!state.holdDeadlineTs || state.holdDeadlineTs <= now) {
        this.set({ holdDeadlineTs: now + (state.holdMinutes || 10) * 60000 });
      }
      return state.holdDeadlineTs;
    },
    totalCents: function () {
      var t = state.priceCents + state.bookingFeeCents;
      (state.upsells || []).forEach(function (u) { t += (u.priceCents || 0) * (u.qty || 1); });
      return t;
    },
    // --- upsell helpers (shared across steps so upgrades can be added/removed anywhere) ---
    findUpsell: function (type) {
      return (state.upsells || []).find(function (u) { return u.type === type; });
    },
    addUpsell: function (type, qty, priceCents) {
      var def = UPSELL_CATALOG.find(function (c) { return c.type === type; }) || {};
      qty = qty || 1;
      priceCents = (priceCents != null) ? priceCents : def.priceCents;
      var existing = this.findUpsell(type);
      if (existing) { existing.qty = (existing.qty || 1) + qty; }
      else { existing = { type: type, qty: qty, priceCents: priceCents }; state.upsells = (state.upsells || []).concat([existing]); }
      // Keep quantity within the catalog's min/max bounds so no step can create an invalid amount.
      if (def.min != null) existing.qty = Math.max(existing.qty, def.min);
      if (def.max != null) existing.qty = Math.min(existing.qty, def.max);
      this.save();
      return state;
    },
    removeUpsell: function (type) {
      var removed = this.findUpsell(type);
      state.upsells = (state.upsells || []).filter(function (u) { return u.type !== type; });
      this.save();
      return removed; // return the removed item so callers can offer Undo
    },
    restoreUpsell: function (item) {
      if (item) { state.upsells = (state.upsells || []).concat([item]); this.save(); }
      return state;
    },
    /** Record that an upgrade has been offered/decided (added OR declined) so
     *  the summary cart can reveal it in sequence — greyed at $0 if declined. */
    markDecided: function (type) {
      state.decided = state.decided || [];
      if (state.decided.indexOf(type) === -1) { state.decided.push(type); this.save(); }
      return state;
    }
  };

  // Catalog of upgrades that can be added/removed from the summary on any step.
  var UPSELL_CATALOG = [
    { type: "travel_protection", label: "Travel protection", icon: "shield-check", priceCents: 2499, perQty: false },
    { type: "extend_stay", label: "Extend stay", icon: "plane", priceCents: 1900, perQty: false },
    { type: "bonus_vacation", label: "Bonus vacation", icon: "palmtree", priceCents: 4900, perQty: false }
  ];

  // Alias keys that may appear in offers.upgrades_display_json.
  var UPGRADE_KEY_ALIASES = {
    travel_protection: ["travel_protection", "travel-protection", "travel_protection_two", "travel-protection-two"],
    extend_stay: ["extend_stay", "extend-stay", "extend_your_stay", "extend-your-stay"],
    bonus_vacation: ["bonus_vacation", "bonus-vacation"]
  };

  function normalizeUpgradeKey(key) {
    return String(key || "").trim().toLowerCase().replace(/-/g, "_");
  }

  function upgradesDisplayList() {
    try {
      var flow = global.SWIFTLY_OFFER_FLOW || {};
      var list = flow.upgradesDisplay || flow.upgrades_display || flow.upgrades_display_json || [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  /** Dollars from SWIFTLY_OFFER_FLOW.upgradesDisplay → cents (fallback if missing). */
  FlowState.upgradeCents = function (key, fallbackCents) {
    var wanted = normalizeUpgradeKey(key);
    var aliases = UPGRADE_KEY_ALIASES[wanted] || [wanted];
    try {
      var list = upgradesDisplayList();
      for (var i = 0; i < list.length; i++) {
        var row = list[i];
        if (!row) continue;
        var k = normalizeUpgradeKey(row.key || row.slug);
        var matched = false;
        for (var a = 0; a < aliases.length; a++) {
          if (k === normalizeUpgradeKey(aliases[a])) { matched = true; break; }
        }
        if (!matched && k !== wanted) continue;
        if (row.value != null && !isNaN(Number(row.value))) {
          return Math.round(Number(row.value) * 100);
        }
      }
    } catch (e) {}
    return fallbackCents;
  };

  /** Re-apply Offer Upgrades Data over catalog + stale localStorage upsell prices. */
  FlowState.refreshUpgradePrices = function () {
    for (var i = 0; i < UPSELL_CATALOG.length; i++) {
      var item = UPSELL_CATALOG[i];
      item.priceCents = FlowState.upgradeCents(item.type, item.priceCents);
    }
    var ups = (FlowState.get().upsells || []);
    var dirty = false;
    for (var u = 0; u < ups.length; u++) {
      var def = UPSELL_CATALOG.find(function (c) { return c.type === ups[u].type; });
      if (def && ups[u].priceCents !== def.priceCents) {
        ups[u].priceCents = def.priceCents;
        dirty = true;
      }
    }
    if (dirty) FlowState.save();
    return UPSELL_CATALOG;
  };

  /**
   * Run cb once upgradesDisplay is available (or after a short wait / DOM ready).
   * Prefer Offer Upgrades Data whenever it lands after the first paint.
   */
  FlowState.onUpgradesReady = function (cb) {
    if (typeof cb !== "function") return;
    var done = false;
    function fire() {
      if (done) return;
      done = true;
      try {
        FlowState.refreshUpgradePrices();
        cb(upgradesDisplayList());
      } catch (e) {}
    }
    if (upgradesDisplayList().length) {
      fire();
      return;
    }
    var tries = 0;
    var timer = setInterval(function () {
      tries += 1;
      if (upgradesDisplayList().length || tries >= 40) {
        clearInterval(timer);
        fire();
      }
    }, 50);
    if (global.document) {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
          if (upgradesDisplayList().length) {
            clearInterval(timer);
            fire();
          }
        });
      }
    }
    global.addEventListener("swiftly:offer-flow-ready", function () {
      clearInterval(timer);
      fire();
    });
  };

  // Apply immediately if SWIFTLY_OFFER_FLOW is already in <head>; re-check via onUpgradesReady later.
  FlowState.refreshUpgradePrices();

  FlowState.upsellCatalog = UPSELL_CATALOG;


  FlowState.hasOfferFlowSession = function () {
    try {
      if (new URLSearchParams(global.location.search).get("session_token")) return true;
      if (global.SWIFTLY_OFFER_FLOW && global.SWIFTLY_OFFER_FLOW.sessionToken) return true;
    } catch (e) {}
    return false;
  };
  global.FlowState = FlowState;

  /* ----------------------------------------------------------
     Shared UI helper: purchase-confirmed toaster.
     Requires an element <div class="pf-toast-wrap" id="toastWrap">
     on the page. Auto-dismisses; also closable.
     ---------------------------------------------------------- */
  global.PFToast = function (msg, opts) {
    opts = opts || {};
    var wrap = document.getElementById("toastWrap");
    if (!wrap) return;
    var toast = document.createElement("div");
    toast.className = "pf-toast";
    toast.setAttribute("role", "status");
    toast.appendChild(document.createTextNode(msg));
    function hide() {
      toast.classList.remove("is-visible");
      setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 320);
    }
    // optional inline action (e.g. Undo)
    if (opts.action && typeof opts.action.onClick === "function") {
      var action = document.createElement("button");
      action.className = "pf-toast__action";
      action.textContent = opts.action.label || "Undo";
      action.addEventListener("click", function () { opts.action.onClick(); hide(); });
      toast.appendChild(action);
    }
    var close = document.createElement("button");
    close.className = "pf-toast__close";
    close.setAttribute("aria-label", "Dismiss");
    close.innerHTML = "&times;";
    toast.appendChild(close);
    wrap.innerHTML = "";
    wrap.appendChild(toast);
    requestAnimationFrame(function () { toast.classList.add("is-visible"); });
    close.addEventListener("click", hide);
    setTimeout(hide, opts.duration || 3200);
  };

  /* ----------------------------------------------------------
     Shared UI helper: editable upgrades cart.
     Renders every catalog upgrade into a container with an
     Add / Remove toggle so a guest can change their mind on
     any step without navigating back. Removing offers Undo.
     ---------------------------------------------------------- */
  global.PFUpsells = {
    render: function (containerId, opts) {
      opts = opts || {};
      var el = document.getElementById(containerId);
      if (!el) return;
      var editable = opts.editable !== false;
      // Upgrades are only editable on the step that "owns" them; others render disabled.
      var active = opts.activeTypes || null; // null => all editable
      var self = this;

      el.classList.add("pf-cart");
      // Static (non-editable) summary reveals each add-on once it's been
      // offered, in sequence. Added upgrades show their price; declined or
      // skipped ones stay listed but greyed out at $0.
      var items = UPSELL_CATALOG;
      if (!editable) {
        var decided = FlowState.get().decided || [];
        items = UPSELL_CATALOG.filter(function (c) {
          return decided.indexOf(c.type) !== -1 || !!FlowState.findUpsell(c.type);
        });
        if (!items.length) {
          el.innerHTML = '<div class="pf-cart__empty">No add-ons yet.</div>';
          return;
        }
      }
      el.innerHTML = items.map(function (c) {
        var u = FlowState.findUpsell(c.type);
        var added = !!u;
        var qty = (u && u.qty) || 1;
        var cmin = c.min || 1;
        var cmax = (c.max != null) ? c.max : Infinity;
        var fixedQty = c.perQty && cmax <= cmin; // quantity can't vary (e.g. exactly 2)
        var label = c.label + ((added && c.perQty && fixedQty) ? " \u00d7 " + qty : "");
        var priceStr;
        if (added) {
          priceStr = FlowState.money((u.priceCents || c.priceCents) * qty);
        } else if (!editable) {
          // Declined/skipped in the static summary — greyed out at $0.
          priceStr = FlowState.money(0);
        } else {
          priceStr = FlowState.money(c.priceCents) + (c.perQty ? "/pass" : "");
        }
        var isActive = !active || active.indexOf(c.type) !== -1;
        var dis = isActive ? "" : " disabled";
        var control = "";
        if (editable) {
          if (added && c.perQty && !fixedQty) {
            // quantity stepper (decrementing past the minimum removes the item; + capped at max)
            var incDis = (dis || (qty >= cmax ? " disabled" : ""));
            control = '<div class="pf-cart__qty">'
              + '<button type="button" class="pf-cart__step" data-dec="' + c.type + '" aria-label="Fewer ' + c.label + '"' + dis + '>\u2212</button>'
              + '<span class="pf-cart__qtynum">' + qty + '</span>'
              + '<button type="button" class="pf-cart__step" data-inc="' + c.type + '" aria-label="More ' + c.label + '"' + incDis + '>+</button>'
              + '<button type="button" class="pf-cart__del" data-remove="' + c.type + '" aria-label="Remove ' + c.label + '"' + dis + '><i data-lucide="trash-2" class="pf-i"></i></button>'
              + '</div>';
          } else if (added) {
            control = '<button type="button" class="pf-cart__btn pf-cart__btn--remove" data-remove="' + c.type + '" aria-label="Remove ' + c.label + '"' + dis + '><i data-lucide="x" class="pf-i"></i>Remove</button>';
          } else {
            control = '<button type="button" class="pf-cart__btn pf-cart__btn--add" data-add="' + c.type + '"' + dis + '><i data-lucide="plus" class="pf-i"></i>Add</button>';
          }
        }
        return '<div class="pf-cart__row' + (added ? "" : " is-off") + '">'
          + '<span class="pf-cart__k"><i data-lucide="' + c.icon + '" class="pf-i"></i>' + label + '</span>'
          + '<span class="pf-cart__v">' + priceStr + '</span>'
          + control
          + '</div>';
      }).join("");
      if (global.lucide) global.lucide.createIcons();

      if (editable && !el._pfWired) {
        el._pfWired = true;
        el.addEventListener("click", function (e) {
          var addBtn = e.target.closest("[data-add]");
          var rmBtn = e.target.closest("[data-remove]");
          var incBtn = e.target.closest("[data-inc]");
          var decBtn = e.target.closest("[data-dec]");
          if (incBtn) {
            var it = incBtn.getAttribute("data-inc");
            var idef = UPSELL_CATALOG.find(function (c) { return c.type === it; }) || {};
            var imax = (idef.max != null) ? idef.max : Infinity;
            var icur = FlowState.findUpsell(it);
            if (!icur || (icur.qty || 1) < imax) {
              FlowState.addUpsell(it, 1);
              self.render(containerId, opts);
              if (opts.onChange) opts.onChange();
            }
            return;
          }
          if (decBtn) {
            var dt = decBtn.getAttribute("data-dec");
            var item = FlowState.findUpsell(dt);
            var ddef = UPSELL_CATALOG.find(function (c) { return c.type === dt; }) || {};
            var dmin = ddef.min || 1;
            if (item && (item.qty || 1) > dmin) {
              item.qty -= 1;
              FlowState.save();
              self.render(containerId, opts);
              if (opts.onChange) opts.onChange();
            } else {
              var gone = FlowState.removeUpsell(dt);
              self.render(containerId, opts);
              if (opts.onChange) opts.onChange();
              var dd = UPSELL_CATALOG.find(function (c) { return c.type === dt; });
              global.PFToast("Removed " + (dd ? dd.label : "upgrade"), {
                action: { label: "Undo", onClick: function () { FlowState.restoreUpsell(gone); self.render(containerId, opts); if (opts.onChange) opts.onChange(); } }
              });
            }
            return;
          }
          if (addBtn) {
            var at = addBtn.getAttribute("data-add");
            var adef = UPSELL_CATALOG.find(function (c) { return c.type === at; }) || {};
            FlowState.addUpsell(at, adef.min || 1);
            self.render(containerId, opts);
            if (opts.onChange) opts.onChange();
            global.PFToast((adef.label || "Upgrade") + " added");
          } else if (rmBtn) {
            var rt = rmBtn.getAttribute("data-remove");
            var removed = FlowState.removeUpsell(rt);
            self.render(containerId, opts);
            if (opts.onChange) opts.onChange();
            var dr = UPSELL_CATALOG.find(function (c) { return c.type === rt; });
            global.PFToast("Removed " + (dr ? dr.label : "upgrade"), {
              action: {
                label: "Undo",
                onClick: function () {
                  FlowState.restoreUpsell(removed);
                  self.render(containerId, opts);
                  if (opts.onChange) opts.onChange();
                }
              }
            });
          }
        });
      }
    }
  };
})(window);
