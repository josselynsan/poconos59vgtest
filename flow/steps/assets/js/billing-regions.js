/* ============================================================
   Country -> State/Province dependency (02-billing)
   ------------------------------------------------------------
   The region dropdown starts empty and disabled. Picking a
   country fills it with that country's subdivisions and swaps
   the placeholder + error copy to the local term ("State" for
   the US, "Province" for Canada).
   ============================================================ */
(function (global) {
  "use strict";

  var REGIONS = {
    "United States": {
      label: "State",
      error: "Select your state.",
      list: [
        ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"],
        ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"],
        ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"],
        ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"],
        ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"],
        ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"],
        ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"],
        ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"],
        ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"],
        ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"],
        ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"],
        ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"],
        ["WI", "Wisconsin"], ["WY", "Wyoming"]
      ]
    },
    "Canada": {
      label: "Province",
      error: "Select your province.",
      list: [
        ["AB", "Alberta"], ["BC", "British Columbia"], ["MB", "Manitoba"],
        ["NB", "New Brunswick"], ["NL", "Newfoundland and Labrador"], ["NS", "Nova Scotia"],
        ["NT", "Northwest Territories"], ["NU", "Nunavut"], ["ON", "Ontario"],
        ["PE", "Prince Edward Island"], ["QC", "Quebec"], ["SK", "Saskatchewan"],
        ["YT", "Yukon"]
      ]
    }
  };

  // Offer Flow / CRM expect ISO country codes on the select value.
  REGIONS["US"] = REGIONS["United States"];
  REGIONS["CA"] = REGIONS["Canada"];

  function bind(countrySel, regionSel) {
    if (!countrySel || !regionSel) return;

    var field = regionSel.closest(".pf-field");
    var errEl = field ? field.querySelector(".pf-field__error") : null;

    function fill() {
      var region = REGIONS[countrySel.value];
      var prev = regionSel.value;

      regionSel.innerHTML = "";
      var placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = region ? region.label : "State";
      regionSel.appendChild(placeholder);

      if (!region) {
        regionSel.disabled = true;
        return;
      }

      region.list.forEach(function (row) {
        var opt = document.createElement("option");
        opt.value = row[0];
        opt.textContent = row[1];
        regionSel.appendChild(opt);
      });
      regionSel.disabled = false;

      // Keep the previous pick only when the new country still has that code.
      var keep = region.list.some(function (row) { return row[0] === prev; });
      regionSel.value = keep ? prev : "";

      if (errEl) errEl.textContent = region.error;
      if (field) field.classList.remove("is-invalid");
      regionSel.classList.remove("is-invalid");
    }

    countrySel.addEventListener("change", fill);
    fill();
  }

  global.BillingRegions = { data: REGIONS, bind: bind };
})(window);
