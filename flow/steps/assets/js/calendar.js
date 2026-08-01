/* ============================================================
   Preferred-dates calendar — two-month range picker.
   Renders into a container and reports check-in / check-out.
   Purely for capturing PREFERRED dates (lead model), not a
   live-availability booking engine.
   ============================================================ */
(function (global) {
  "use strict";

  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  function ymd(d) { return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  function sameDay(a, b) { return a && b && ymd(a) === ymd(b); }
  function startOfDay(d) { var x = new Date(d); x.setHours(0,0,0,0); return x; }

  function PreferredDates(container, opts) {
    opts = opts || {};
    this.el = container;
    this.onChange = opts.onChange || function () {};
    // start from today; user can page forward
    var today = startOfDay(new Date());
    this.view = new Date(today.getFullYear(), today.getMonth(), 1);
    this.today = today;
    this.minDate = opts.minDate ? startOfDay(opts.minDate) : today;
    this.checkIn = opts.checkIn ? startOfDay(new Date(opts.checkIn)) : null;
    this.checkOut = opts.checkOut ? startOfDay(new Date(opts.checkOut)) : null;
    // Fixed-length package: when set, picking a check-in auto-locks check-out to +N nights.
    this.nights = opts.nights ? parseInt(opts.nights, 10) : null;
    this.render();
  }

  PreferredDates.prototype.pick = function (date) {
    if (date < this.minDate) return;
    if (this.nights) {
      // Locked stay length — any click sets check-in; check-out follows automatically.
      this.checkIn = date;
      this.checkOut = startOfDay(new Date(date.getFullYear(), date.getMonth(), date.getDate() + this.nights));
    } else if (!this.checkIn || (this.checkIn && this.checkOut)) {
      this.checkIn = date; this.checkOut = null;
    } else if (date <= this.checkIn) {
      this.checkIn = date; this.checkOut = null;
    } else {
      this.checkOut = date;
    }
    this.render();
    this.onChange({ checkIn: this.checkIn, checkOut: this.checkOut });
  };

  /** Wipe the selection (used when the guest flips "Know your dates?" back to No). */
  PreferredDates.prototype.clear = function () {
    this.checkIn = null;
    this.checkOut = null;
    this.render();
    this.onChange({ checkIn: null, checkOut: null });
  };

  PreferredDates.prototype.monthHtml = function (base) {
    var year = base.getFullYear(), month = base.getMonth();
    var first = new Date(year, month, 1);
    var startDow = first.getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var cells = "";
    // leading blanks
    for (var b = 0; b < startDow; b++) cells += '<span class="cal-day is-empty"></span>';
    for (var d = 1; d <= daysInMonth; d++) {
      var date = new Date(year, month, d);
      var cls = "cal-day";
      var disabled = date < this.minDate;
      if (disabled) cls += " is-disabled";
      if (sameDay(date, this.checkIn)) cls += " is-start";
      if (sameDay(date, this.checkOut)) cls += " is-end";
      if (this.checkIn && this.checkOut && date > this.checkIn && date < this.checkOut) cls += " is-inrange";
      cells += '<button type="button" class="' + cls + '" data-date="' + date.getTime() + '"' + (disabled ? " disabled" : "") + ">" + d + "</button>";
    }
    var head = '<div class="cal-monthname">' + MONTHS[month] + " " + year + "</div>";
    var week = '<div class="cal-week">' + DOW.map(function (x) { return "<span>" + x + "</span>"; }).join("") + "</div>";
    return '<div class="cal-month">' + head + week + '<div class="cal-grid">' + cells + "</div></div>";
  };

  PreferredDates.prototype.render = function () {
    var m2 = new Date(this.view.getFullYear(), this.view.getMonth() + 1, 1);
    var canGoBack = this.view > new Date(this.today.getFullYear(), this.today.getMonth(), 1);
    var self = this;
    this.el.innerHTML =
      '<div class="cal-nav">' +
        '<button type="button" class="cal-arrow" data-nav="-1"' + (canGoBack ? "" : " disabled") + ' aria-label="Previous month">&#8249;</button>' +
        '<button type="button" class="cal-arrow" data-nav="1" aria-label="Next month">&#8250;</button>' +
      '</div>' +
      '<div class="cal-months">' + this.monthHtml(this.view) + this.monthHtml(m2) + "</div>";

    this.el.querySelectorAll("[data-nav]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var dir = parseInt(btn.getAttribute("data-nav"), 10);
        self.view = new Date(self.view.getFullYear(), self.view.getMonth() + dir, 1);
        self.render();
      });
    });
    this.el.querySelectorAll(".cal-day[data-date]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        self.pick(startOfDay(new Date(parseInt(btn.getAttribute("data-date"), 10))));
      });
    });
  };

  global.PreferredDates = PreferredDates;
})(window);
