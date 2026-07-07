/* Who benefits (DRISTI page) — role switcher. Clicking a role reveals
   that role's benefit panel. Progressive enhancement: without JS the
   first panel shows and all remain in the DOM. */
(function () {
  "use strict";
  var sec = document.getElementById("benefits");
  if (!sec) return;
  var btns = Array.prototype.slice.call(sec.querySelectorAll(".role-btn"));
  var panels = Array.prototype.slice.call(sec.querySelectorAll(".role-panel"));

  function show(role) {
    btns.forEach(function (b) {
      var on = b.getAttribute("data-role") === role;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    panels.forEach(function (p) {
      p.classList.toggle("is-active", p.getAttribute("data-role-panel") === role);
    });
  }

  btns.forEach(function (b) {
    b.addEventListener("click", function () { show(b.getAttribute("data-role")); });
  });
})();
