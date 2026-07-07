/* The 10 Unlocks (DRISTI page) — click-to-unlock cards with a running
   "days off the clock" tally, N/10 progress, dimension filters, and
   Unlock all / Reset. Progressive enhancement: without JS the section
   still renders every card face; the bodies are revealed via .is-open. */
(function () {
  "use strict";
  var sec = document.getElementById("unlocks");
  if (!sec) return;

  var cards = Array.prototype.slice.call(sec.querySelectorAll(".unlock"));
  var countEl = sec.querySelector("[data-count]");
  var fillEl = sec.querySelector(".up-fill");
  var progLabel = sec.querySelector(".up-label");
  var opened = [];              // cards currently open (insertion order)
  var shown = 0;                // number currently displayed in the tally
  var raf = null;

  function contains(c) { return opened.indexOf(c) !== -1; }

  function daysOpen() {
    var t = 0;
    opened.forEach(function (c) { t += parseInt(c.getAttribute("data-days"), 10) || 0; });
    return t;
  }

  function animateCount(to) {
    if (raf) cancelAnimationFrame(raf);
    var from = shown, start = null, dur = 620;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / dur);
      var e = 1 - Math.pow(1 - p, 3);
      countEl.textContent = Math.round(from + (to - from) * e);
      if (p < 1) { raf = requestAnimationFrame(step); }
      else { shown = to; raf = null; }
    }
    raf = requestAnimationFrame(step);
  }

  function updateProgress() {
    var n = opened.length;
    fillEl.style.width = (n / cards.length * 100) + "%";
    progLabel.textContent = n + " / " + cards.length + " unlocked";
    sec.classList.toggle("is-complete", n === cards.length);
  }

  function refresh() { animateCount(daysOpen()); updateProgress(); }

  function setOpen(card, open) {
    var isOpen = card.classList.contains("is-open");
    if (open === isOpen) return;
    card.classList.toggle("is-open", open);
    var face = card.querySelector(".unlock-face");
    if (face) face.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) { if (!contains(card)) opened.push(card); }
    else { var i = opened.indexOf(card); if (i !== -1) opened.splice(i, 1); }
  }

  cards.forEach(function (card) {
    var face = card.querySelector(".unlock-face");
    if (!face) return;
    face.addEventListener("click", function () {
      setOpen(card, !card.classList.contains("is-open"));
      refresh();
    });
  });

  // dimension filters
  sec.querySelectorAll(".uf").forEach(function (btn) {
    btn.addEventListener("click", function () {
      sec.querySelectorAll(".uf").forEach(function (b) { b.classList.toggle("is-active", b === btn); });
      var dim = btn.getAttribute("data-dim");
      cards.forEach(function (c) {
        var show = (dim === "all" || c.getAttribute("data-dim") === dim);
        c.style.display = show ? "" : "none";
      });
    });
  });

  var allBtn = sec.querySelector(".up-all");
  var resetBtn = sec.querySelector(".up-reset");

  if (allBtn) allBtn.addEventListener("click", function () {
    // open only the visible cards, staggered, so the tally climbs
    var visible = cards.filter(function (c) { return c.style.display !== "none"; });
    visible.forEach(function (c, i) {
      setTimeout(function () { setOpen(c, true); refresh(); }, i * 75);
    });
  });

  if (resetBtn) resetBtn.addEventListener("click", function () {
    cards.forEach(function (c) { setOpen(c, false); });
    refresh();
  });

  updateProgress();
})();
