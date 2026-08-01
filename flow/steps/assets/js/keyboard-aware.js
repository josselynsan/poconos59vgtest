/* ============================================================
   Keep the bottom bars glued to the bottom of the visible area
   ------------------------------------------------------------
   Measured in the iOS 18.6 simulator, with the keyboard open:

     * `interactive-widget=resizes-content` is NOT honoured --
       innerHeight stays at its full value (678) while
       visualViewport.height drops (455). It was removed from the
       viewport meta: Android DOES honour it, which would shrink the
       layout viewport and lift the bar above the keyboard there --
       the opposite of the intended behaviour.
     * Worse, iOS is INCONSISTENT about what `position: fixed`
       is anchored to. Immediately after focus the bar sits at
       the bottom of the LAYOUT viewport (behind the keyboard);
       after any scroll, iOS re-anchors it to the VISUAL viewport
       and it jumps up over the page content.

   Because the anchoring changes underneath us, an open-loop
   formula (translate by innerHeight - vvHeight - offsetTop)
   is wrong half the time -- it double-counts once iOS has already
   moved the bar. So this is CLOSED-LOOP instead: every frame,
   measure where the bar actually is, compare with where it should
   be, and fold the difference into the transform. That converges
   in a frame and is correct under either anchoring mode.

   Target: the bar's bottom edge sits on the bottom edge of the
   LAYOUT viewport -- the bottom of the page, always. With the
   keyboard up that puts it behind the keyboard (not visible), which
   is intended: it must never rise up over the form content. It
   comes back into view as soon as the keyboard is dismissed.
   ============================================================ */
(function (global) {
  "use strict";

  var MOBILE = "(max-width: 900px)";
  var VAR = "--pf-bar-ty";
  var EPSILON = 0.5;          // px of error worth correcting
  var MAX_STEP = 400;         // sanity clamp on any single correction

  function init() {
    var vv = global.visualViewport;
    var mq = global.matchMedia(MOBILE);
    var root = document.documentElement;

    var style = document.createElement("style");
    style.appendChild(document.createTextNode(
      "@media (max-width: 900px) {\n" +
      "  .pf-actionbar, .pf-offerbar {\n" +
      "    transform: translateY(var(" + VAR + ", 0px));\n" +
      "  }\n" +
      "}"
    ));
    document.head.appendChild(style);

    var ty = 0;                 // currently applied translateY, px
    var rafId = null;
    var quiet = 0;              // frames with nothing to correct
    var focused = false;        // a text field holds focus (keyboard likely up)

    function anchor() {
      return document.querySelector(".pf-actionbar") ||
             document.querySelector(".pf-offerbar");
    }

    function correct() {
      var el = anchor();
      if (!el || !mq.matches || !vv) {
        if (ty !== 0) { ty = 0; root.style.setProperty(VAR, "0px"); }
        return false;
      }
      // Target the LAYOUT viewport bottom, which is what getBoundingClientRect
      // is measured against. With no keyboard that is simply the bottom of the
      // screen. With the keyboard up it is BEHIND the keyboard -- which is the
      // intent: the bar stays where it belongs instead of rising over the form.
      // When iOS re-anchors the bar to the visual viewport mid-scroll, this
      // pushes it straight back down.
      var target = global.innerHeight;
      var delta = target - el.getBoundingClientRect().bottom;
      if (Math.abs(delta) < EPSILON) return false;
      if (delta > MAX_STEP) delta = MAX_STEP;
      if (delta < -MAX_STEP) delta = -MAX_STEP;
      ty += delta;
      root.style.setProperty(VAR, ty.toFixed(2) + "px");
      return true;
    }

    function tick() {
      quiet = correct() ? 0 : quiet + 1;
      // While a field is focused, NEVER stop: iOS re-anchors fixed elements at
      // scroll end without firing anything we can listen for, so a loop that
      // idles out leaves the bar stranded off-screen. Otherwise wind down.
      rafId = (focused || quiet < 90) ? global.requestAnimationFrame(tick) : null;
    }
    function wake() {
      quiet = 0;
      if (rafId === null) rafId = global.requestAnimationFrame(tick);
    }

    if (vv) {
      vv.addEventListener("resize", wake);
      vv.addEventListener("scroll", wake);
    }
    global.addEventListener("scroll", wake, { passive: true });
    global.addEventListener("resize", wake);
    global.addEventListener("touchstart", wake, { passive: true });
    global.addEventListener("touchmove", wake, { passive: true });
    global.addEventListener("touchend", wake, { passive: true });
    global.addEventListener("orientationchange", function () {
      global.setTimeout(wake, 350);
    });
    document.addEventListener("focusin", function () { focused = true; wake(); });
    document.addEventListener("focusout", function () { focused = false; wake(); });
    wake();

  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window);
