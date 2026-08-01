/* ============================================================
   Legal modal viewer (QA: footer T&C / Privacy links should open
   a modal instead of leaving the checkout).
   Intercepts clicks on links to the legal pages and shows them in
   an in-page overlay. The copy is inlined below -- lifted verbatim
   from terms-and-conditions.html / privacy-policy.html, with those
   pages' own styles scoped under .legal-overlay -- so the modal is
   real DOM rather than an <iframe>.
   Links keep their real href, so no-JS and middle-click still work.
   ============================================================ */
(function () {
  "use strict";

  var LEGAL = /(terms-and-conditions|privacy-policy)\.html/;

  /* Copy lifted from the standalone legal pages. Keep in sync if those change. */
  var DOCS = {
    terms: {
      title: "Terms & Conditions",
      html: "<main class=\"legal-main\">\n    <h1>Terms &amp; Conditions</h1>\n    <p class=\"legal-updated\">Last updated: <span data-year>2026</span></p>\n\n    <h2>1. The Promotion</h2>\n    <p>This promotional vacation package is promoted and fulfilled by Sunstate Client Services Inc. dba Vacation Gurus, LLC (&ldquo;Vacation Gurus,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;). By purchasing a package, you agree to these Terms &amp; Conditions and our Privacy Policy.</p>\n\n    <h2>2. Eligibility</h2>\n    <ul>\n      <li>Purchasers must be at least 21 years of age and possess a valid government-issued photo ID and a major credit card.</li>\n      <li>Offers are limited to one package per household per 12-month period.</li>\n      <li>Packages are not available to residents of areas where this type of promotion is prohibited by law.</li>\n    </ul>\n\n    <h2>3. Package Details</h2>\n    <p>Your package includes the accommodations, stay length, and any promotional extras described on your order confirmation. Package prices do not include hotel taxes, which vary and are payable upon check-in. Upgrades and add-ons purchased during checkout are listed separately on your confirmation.</p>\n\n    <h2>4. Reservations &amp; Travel Dates</h2>\n    <ul>\n      <li>You have up to 12 months from the date of purchase to complete your travel.</li>\n      <li>All reservations are subject to availability and require a minimum advance notice. Holiday periods and peak season dates may carry additional restrictions or surcharges.</li>\n      <li>Resort bookings require up to 2 business days to process after your Traveler Profile is complete.</li>\n    </ul>\n\n    <h2>5. Cancellations, Changes &amp; Refunds</h2>\n    <p>Cancellation and refund eligibility depend on the package purchased and the timing of your request. Optional Travel Protection, where purchased, provides a full refund of the package price if you cancel for any reason before check-in. Contact our guest services team for assistance with changes or cancellations.</p>\n\n    <h2>6. Marketing Consent</h2>\n    <p>Where you have provided express written consent during checkout, you agree to receive promotional emails, calls, and SMS/MMS/RCS texts &mdash; including via auto-dialer, prerecorded, or AI-generated voice &mdash; from or on behalf of Sunstate Client Services Inc. dba VacationGurus, Travel4Less, regardless of any Do Not Call Registry. Message and data rates may apply; frequency varies. Reply STOP to opt out or HELP for help. Consent is not required to purchase.</p>\n\n    <h2>7. Limitations of Liability</h2>\n    <p>Vacation Gurus acts as a promotional marketing company for participating resorts. Accommodations are provided and operated by the resort named on your confirmation, and your stay is subject to the resort&rsquo;s own policies. To the maximum extent permitted by law, Vacation Gurus is not liable for indirect, incidental, or consequential damages arising from your stay.</p>\n\n    <h2>8. Contact</h2>\n    <p>Questions about these Terms &amp; Conditions can be directed to our guest services team through the contact details on your order confirmation.</p>\n\n    <p><em>Seller of Travel &mdash; Florida: ST44476.</em></p>\n  </main>"
    },
    privacy: {
      title: "Privacy Policy",
      html: "<main class=\"legal-main\">\n    <h1>Privacy Policy</h1>\n    <p class=\"legal-updated\">Last updated: <span data-year>2026</span></p>\n\n    <h2>1. Who We Are</h2>\n    <p>Vacation packages on this site are promoted and fulfilled by Sunstate Client Services Inc. dba Vacation Gurus, LLC (&ldquo;Vacation Gurus,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;). This policy describes how we collect, use, and protect your personal information. It should be read together with our Terms &amp; Conditions.</p>\n\n    <h2>2. Information We Collect</h2>\n    <ul>\n      <li><strong>Contact details</strong> you provide during checkout: name, email address, and phone number.</li>\n      <li><strong>Billing details</strong> needed to process your purchase: billing address and payment information. Card details are processed by our payment provider and are not stored on our servers.</li>\n      <li><strong>Trip preferences</strong> such as preferred travel dates and selected upgrades.</li>\n      <li><strong>Usage data</strong> collected automatically through cookies and similar technologies, such as pages visited and device type.</li>\n    </ul>\n\n    <h2>3. How We Use Your Information</h2>\n    <ul>\n      <li>To process your order, confirm your reservation with the resort, and provide guest support.</li>\n      <li>To send transactional messages about your purchase, Traveler Profile, and booking status.</li>\n      <li>With your express consent, to send promotional emails, calls, and SMS/MMS/RCS texts. You can opt out at any time &mdash; reply STOP to texts or use the unsubscribe link in any email.</li>\n      <li>To improve our websites, offers, and customer experience.</li>\n    </ul>\n\n    <h2>4. Sharing Your Information</h2>\n    <p>We share your information only as needed to fulfill your vacation package: with the resort providing your accommodations, with our payment processor, and with service providers who support our operations under confidentiality obligations. We do not sell your personal information.</p>\n\n    <h2>5. Cookies</h2>\n    <p>We use cookies and local storage to remember your order progress, keep your checkout session working, and understand how visitors use our site. You can control cookies through your browser settings; disabling them may affect checkout functionality.</p>\n\n    <h2>6. Data Security &amp; Retention</h2>\n    <p>We use industry-standard safeguards, including encryption in transit, to protect your information. We retain personal information only as long as needed for the purposes described in this policy or as required by law.</p>\n\n    <h2>7. Your Choices</h2>\n    <ul>\n      <li>Opt out of marketing texts by replying STOP, or of emails via the unsubscribe link.</li>\n      <li>Request access to, correction of, or deletion of your personal information by contacting our guest services team.</li>\n    </ul>\n\n    <h2>8. Contact</h2>\n    <p>Privacy questions or requests can be directed to our guest services team through the contact details on your order confirmation.</p>\n\n    <p><em>Seller of Travel &mdash; Florida: ST44476.</em></p>\n  </main>"
    }
  };

  var css = "" +
    ".legal-overlay{position:fixed;inset:0;z-index:1100;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(16,34,47,.62);}" +
    ".legal-overlay.is-open{display:flex;}" +
    ".legal-overlay__card{position:relative;width:min(920px,96vw);height:min(760px,88vh);background:#fff;border-radius:14px;box-shadow:0 24px 64px rgba(0,0,0,.35);overflow:hidden;display:flex;flex-direction:column;}" +
    ".legal-overlay__bar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-bottom:1px solid #e3e8ee;}" +
    ".legal-overlay__title{font-weight:800;font-size:16px;color:#10222f;margin:0;}" +
    ".legal-overlay__close{border:none;background:none;font-size:26px;line-height:1;cursor:pointer;color:#5b6b79;padding:2px 6px;}" +
    /* replaces the old iframe: the document body scrolls in-place */
    ".legal-overlay__body{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:0 16px;}" +
    ".legal-overlay .legal-main { max-width: 860px; margin: 0 auto; padding: 32px 20px 56px; }" +
    ".legal-overlay .legal-main h1 { font-size: 32px; font-weight: 800; color: var(--ink); margin: 0 0 6px; }" +
    ".legal-overlay .legal-updated { color: var(--muted); font-size: 14px; margin: 0 0 28px; }" +
    ".legal-overlay .legal-main h2 { font-size: 20px; font-weight: 800; color: var(--navy); margin: 28px 0 10px; }" +
    ".legal-overlay .legal-main p, .legal-overlay .legal-main li { font-size: 15px; line-height: 1.65; color: var(--text); }" +
    ".legal-overlay .legal-main ul { padding-left: 22px; }" +
    ".legal-overlay .legal-main a { color: var(--navy); }" +
    ".legal-overlay .legal-main { padding: 8px 4px 24px; }" +
    "@media (max-width:600px){.legal-overlay{padding:10px;}.legal-overlay__card{height:calc(100dvh - 20px);}.legal-overlay__body{padding:0 12px;}}";

  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  var overlay = document.createElement("div");
  overlay.className = "legal-overlay";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML =
    '<div class="legal-overlay__card" role="dialog" aria-modal="true">' +
    '  <div class="legal-overlay__bar">' +
    '    <p class="legal-overlay__title"></p>' +
    '    <button type="button" class="legal-overlay__close" aria-label="Close">&times;</button>' +
    "  </div>" +
    '  <div class="legal-overlay__body"></div>' +
    "</div>";
  document.body.appendChild(overlay);

  var body = overlay.querySelector(".legal-overlay__body");
  var title = overlay.querySelector(".legal-overlay__title");
  var rendered = null;

  function open(kind) {
    var doc = DOCS[kind];
    if (!doc) return;
    title.textContent = doc.title;
    if (rendered !== kind) {
      body.innerHTML = doc.html;
      // the standalone pages stamp the year with their own inline script
      body.querySelectorAll("[data-year]").forEach(function (el) {
        el.textContent = new Date().getFullYear();
      });
      rendered = kind;
    }
    body.scrollTop = 0;
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function close() {
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  /* ---- Deep links: #terms / #privacy open the modal and stay in sync
     with the address bar, so the popup state is shareable and the
     back button dismisses it. ---- */
  var current = null; // kind currently shown: "terms" | "privacy" | null

  function kindFromHash() {
    var h = location.hash.replace("#", "");
    return h === "terms" || h === "privacy" ? h : null;
  }
  function syncFromHash() {
    var k = kindFromHash();
    if (k && k !== current) { current = k; open(k); }
    else if (!k && current) { current = null; close(); }
  }
  function requestClose() {
    // strip the hash without adding a history entry, then close
    if (kindFromHash()) history.replaceState(null, "", location.pathname + location.search);
    current = null;
    close();
  }

  window.addEventListener("hashchange", syncFromHash);
  syncFromHash(); // auto-open when the page is loaded with #terms / #privacy

  overlay.querySelector(".legal-overlay__close").addEventListener("click", requestClose);
  overlay.addEventListener("click", function (e) { if (e.target === overlay) requestClose(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && overlay.classList.contains("is-open")) requestClose(); });

  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || !LEGAL.test(a.getAttribute("href") || "")) return;
    e.preventDefault();
    // route through the hash so the URL reflects the open popup
    location.hash = a.getAttribute("href").indexOf("terms-and-conditions") !== -1 ? "terms" : "privacy";
  });
})();
