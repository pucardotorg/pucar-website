/* =========================================================
   PUCAR — policy consultation countdown
   Progressively enhances the #policyCountdown badge on the
   /contributors/ hub's Policy section: computes days remaining
   until the deadline live in the visitor's browser (not baked
   in at build time), so it stays accurate across a static
   deploy that might not rebuild daily. Same daysUntil() math
   as js/collaborate.js's "closes in N days" freshness.
   ========================================================= */
(function () {
  "use strict";

  var el = document.getElementById("policyCountdown");
  if (!el) return;
  var numEl = document.getElementById("policyCountdownNum");
  var labelEl = document.getElementById("policyCountdownLabel");
  if (!numEl || !labelEl) return;

  function daysUntil(iso) {
    var ms = new Date(iso + "T23:59:59") - new Date();
    return Math.ceil(ms / 86400000);
  }

  var d = daysUntil(el.getAttribute("data-deadline"));

  if (d < 0) {
    numEl.textContent = "Closed";
    labelEl.textContent = "consultation window has ended";
  } else if (d === 0) {
    numEl.textContent = "Today";
    labelEl.textContent = "is the last day to respond";
    el.classList.add("is-urgent");
  } else {
    numEl.textContent = String(d);
    labelEl.textContent = d === 1 ? "day left" : "days left";
    if (d <= 5) el.classList.add("is-urgent");
  }
})();
