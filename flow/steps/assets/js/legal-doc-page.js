/* Offer Flow legal full-page injector.
 * Body HTML comes from offers.terms_conditions / offers.privacy_policy
 * injected as window.SWIFTLY_OFFER_FLOW.terms_conditions / .privacy_policy
 * by serveOfferFlowStepHtml (requires ?offer_id=…).
 */
(function () {
  "use strict";

  function yearFill() {
    var y = String(new Date().getFullYear());
    document.querySelectorAll("[data-year]").forEach(function (el) {
      el.textContent = y;
    });
  }

  function wrap(html) {
    var t = String(html || "").trim();
    if (!t) return t;
    if (/class\s*=\s*["'][^"']*legal-main/i.test(t) || /class\s*=\s*["'][^"']*tc-content/i.test(t) || /<main[\s>]/i.test(t)) {
      return t;
    }
    return '<div class="tc-content">' + t + "</div>";
  }

  function emptyMsg(kind) {
    if (kind === "privacy") {
      return '<p class="legal-doc-empty">Privacy Policy has not been configured for this offer.</p>';
    }
    return '<p class="legal-doc-empty">Terms and Conditions have not been configured for this offer.</p>';
  }

  function previewMsg(kind) {
    return (
      '<p class="legal-doc-empty">Open this page with <code>offer_id</code> ' +
      "(Offer Flow) to load " +
      (kind === "privacy" ? "Privacy Policy" : "Terms &amp; Conditions") +
      " from the offer.</p>"
    );
  }

  function apply() {
    yearFill();
    var body = document.getElementById("legalDocBody");
    if (!body) return;
    var kind = (document.body.getAttribute("data-legal-doc") || "terms").toLowerCase();
    var key = kind === "privacy" ? "privacy_policy" : "terms_conditions";
    var flow = window.SWIFTLY_OFFER_FLOW || {};

    if (Object.prototype.hasOwnProperty.call(flow, key)) {
      var fromOffer = flow[key] == null ? "" : String(flow[key]).trim();
      body.innerHTML = fromOffer ? wrap(fromOffer) : emptyMsg(kind);
      return;
    }
    body.innerHTML = previewMsg(kind);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply);
  } else {
    apply();
  }
})();
