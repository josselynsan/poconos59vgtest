/* ============================================================
   Celebrate — confetti + cash-register ("ka-ching") sound.
   Fired once when the final confirmation page loads.

   - Three staggered confetti explosions (center, then left +
     right) using the Massanutten/VacationVIP brand palette
     (coral / navy / gold / yellow / white). Requires the
     vendored canvas-confetti lib to be loaded first.
   - Plays the real cash-register recording
     (assets/sounds/cash-register.mp3) at a modest volume.
   - Full-page navigations don't carry a user gesture, so
     browsers usually block load-time audio. We try to play
     immediately, and if that's blocked we arm a one-time
     listener so the sound fires on the first tap/click/key.
   - Honors prefers-reduced-motion: no confetti AND no sound.
   ============================================================ */
(function (window, document) {
  "use strict";

  var BRAND_COLORS = [
    "#e9654a", // coral
    "#215272", // navy
    "#F2C544", // gold
    "#fffb53", // yellow
    "#ffffff",
  ];

  function prefersReducedMotion() {
    return (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  /* ---------- Confetti: three explosions ---------- */
  function fireConfetti() {
    if (typeof window.confetti !== "function") return;

    var base = {
      spread: 360,
      startVelocity: 45,
      gravity: 1,
      decay: 0.92,
      ticks: 280,
      scalar: 1.05,
      colors: BRAND_COLORS,
      disableForReducedMotion: true,
    };

    // Three radial pops, staggered so they read as three distinct
    // explosions across the screen.
    var bursts = [
      { origin: { x: 0.5, y: 0.42 }, particleCount: 200 }, // center
      { origin: { x: 0.22, y: 0.55 }, particleCount: 150 }, // left
      { origin: { x: 0.78, y: 0.55 }, particleCount: 150 }, // right
    ];

    bursts.forEach(function (b, i) {
      window.setTimeout(function () {
        window.confetti(Object.assign({}, base, b));
      }, i * 220);
    });
  }

  /* ---------- Sound: real cash-register recording ---------- */
  var soundFired = false;

  function playOnce() {
    if (soundFired) return true;
    try {
      var audio = new Audio(Celebrate.soundSrc);
      audio.volume = Celebrate.volume;
      var pr = audio.play();
      if (pr && typeof pr.then === "function") {
        pr.then(function () { soundFired = true; }).catch(function () {
          armGestureFallback();
        });
      } else {
        soundFired = true;
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function armGestureFallback() {
    // Browsers block load-time audio on a freshly-navigated page, so play on
    // the first ANY interaction — including scroll/move — so it fires the
    // instant the guest does anything on the confirmation screen.
    var events = [
      "pointerdown", "pointerup", "touchstart", "touchmove",
      "mousedown", "mousemove", "keydown", "click", "scroll", "wheel",
    ];
    function cleanup() {
      events.forEach(function (ev) {
        window.removeEventListener(ev, handler, true);
      });
    }
    function handler() {
      if (soundFired) { cleanup(); return; }
      try {
        var audio = new Audio(Celebrate.soundSrc);
        audio.volume = Celebrate.volume;
        var pr = audio.play();
        if (pr && typeof pr.then === "function") {
          pr.then(function () { soundFired = true; cleanup(); }).catch(function () {});
        } else {
          soundFired = true; cleanup();
        }
      } catch (e) { /* ignore */ }
    }
    events.forEach(function (ev) {
      window.addEventListener(ev, handler, true);
    });
  }

  var Celebrate = {
    soundSrc: "assets/sounds/cash-register.mp3",
    volume: 0.6,
    // Play just the cash-register cue. Safe to call from a user gesture on a
    // prior page (e.g. the Step 4 "confirm" tap) so it's guaranteed to be heard
    // even though the next page can't autoplay it.
    playSound: function () { playOnce(); },
    fire: function () {
      fireConfetti(); // no-ops under prefers-reduced-motion (disableForReducedMotion)
      playOnce();
    },
  };

  window.Celebrate = Celebrate;
})(window, document);
