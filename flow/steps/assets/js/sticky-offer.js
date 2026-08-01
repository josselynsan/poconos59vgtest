/* ============================================================
   CR-09 — Mobile sticky offer bar (checkout-wide)
   ------------------------------------------------------------
   Ports the landing page's sticky offer strip (badge + package
   + price, NO button) into every payment-flow step. It pins to
   the bottom of the viewport and sits directly ABOVE the page's
   fixed thumb-zone action bar when one is present. Mobile only.
   All values pull from FlowState — nothing hardcoded.
   ============================================================ */
(function (global) {
  "use strict";

  function init() {
    if (!global.FlowState) return;
    var s = global.FlowState.get();

    var css = [
      ".pf-offerbar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 59;",
      "  display: flex; align-items: center; justify-content: space-between; gap: 10px;",
      "  background: var(--white); border-top: 1px solid var(--line);",
      "  padding: 8px 12px; font-family: var(--font); }",
      ".pf-offerbar__badge { flex: 0 0 auto; margin-left: -12px; background: var(--navy); color: #fff;",
      "  font-weight: 800; text-transform: uppercase; text-align: center; font-size: 13px; line-height: .95;",
      "  padding: 8px 12px 8px 10px; border-radius: 0 30px 30px 0; }",
      ".pf-offerbar__info { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }",
      ".pf-offerbar__days { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; color: var(--navy); }",
      ".pf-offerbar__pkg { font-size: 13px; font-weight: 700; color: var(--ink); text-transform: uppercase; line-height: 1.15; }",
      ".pf-offerbar__price { flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; gap: 1px;",
      "  padding-left: 14px; margin-left: 2px; border-left: 1px solid var(--line); }",
      ".pf-offerbar__retail { font-size: 11px; font-weight: 600; color: var(--muted); white-space: nowrap; }",
      ".pf-offerbar__retail s { color: var(--coral); }",
      ".pf-offerbar__amount { font-size: 24px; font-weight: 900; color: var(--ink); line-height: 1; }",
      ".pf-offerbar__per { font-size: 10px; font-weight: 600; color: var(--text); white-space: nowrap; }",
      "@media (min-width: 901px) { .pf-offerbar { display: none !important; } }",
      /* Single owner for the bottom reservation: place() publishes the size as
         --pf-barspace, this rule spends it. Nothing writes body padding inline. */
      "@media (max-width: 900px) { body { padding-bottom: var(--pf-barspace, 0px); } }",
      /* Short viewports (iPhone SE class) — slim the bar so the fixed bottom
         stack leaves more of the 667px screen for scrollable content. */
      "@media (max-height: 700px) {",
      "  .pf-offerbar { padding: 5px 10px; gap: 8px; }",
      "  .pf-offerbar__badge { font-size: 11px; padding: 6px 10px 6px 8px; margin-left: -10px; }",
      "  .pf-offerbar__days { font-size: 10px; }",
      "  .pf-offerbar__pkg { font-size: 11.5px; }",
      "  .pf-offerbar__retail { font-size: 10px; }",
      "  .pf-offerbar__amount { font-size: 20px; }",
      "  .pf-offerbar__per { font-size: 9px; }",
      "}"
    ].join("\n");

    var style = document.createElement("style");
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);

    var bar = document.createElement("div");
    bar.className = "pf-offerbar";
    bar.setAttribute("role", "note");
    bar.setAttribute("aria-label", "Your offer");
    bar.innerHTML =
      '<div class="pf-offerbar__badge">' + s.discountPct + "%<br>OFF!</div>" +
      '<div class="pf-offerbar__info">' +
        '<span class="pf-offerbar__days">' + s.stayLabel + "</span>" +
        '<span class="pf-offerbar__pkg">' + s.resortName + "</span>" +
      "</div>" +
      '<div class="pf-offerbar__price">' +
        '<span class="pf-offerbar__retail">Retail <s>' + global.FlowState.money(s.retailCents) + "</s></span>" +
        '<span class="pf-offerbar__amount">' + global.FlowState.money(s.priceCents) + "</span>" +
        '<span class="pf-offerbar__per">' + s.perLabel + "</span>" +
      "</div>";
    document.body.appendChild(bar);

    var mq = global.matchMedia("(max-width: 900px)");

    // Sit directly above the page's fixed action bar (if it has one) and keep
    // the page content clear of both.
    //
    // The space the bars need is published as --pf-barspace and CONSUMED IN CSS
    // (see the rule above). This function never writes padding directly: with a
    // single owner, keyboard-aware.js can zero the reservation by overriding the
    // variable, instead of two mechanisms fighting over an inline style.
    function place() {
      var ab = document.querySelector(".pf-actionbar");
      var root = document.documentElement;
      if (!mq.matches) {
        root.style.removeProperty("--pf-barspace");
        if (ab) { ab.style.boxShadow = ""; ab.style.borderTop = ""; }
        return;
      }
      var offset = 0;
      if (ab && getComputedStyle(ab).position === "fixed") {
        // overlap the action bar by 1px — its height can be fractional, and any
        // subpixel gap lets the page background scroll through between the bars
        offset = Math.floor(ab.getBoundingClientRect().height) - 1;
        ab.style.boxShadow = "none";
        ab.style.borderTop = "0";
      }
      bar.style.bottom = offset + "px";
      root.style.setProperty("--pf-barspace", (offset + bar.offsetHeight + 16) + "px");
    }
    global.addEventListener("resize", place);
    place();
    // Re-measure after fonts/layout settle.
    setTimeout(place, 250);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window);
