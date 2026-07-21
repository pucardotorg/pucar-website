/* Careers — open a role's full JD in a modal on click. Progressive
   enhancement: each row is still a real link to the role page, so with
   no JS (or if a role has no inline source) the click just navigates. */
(function () {
  "use strict";
  var overlay = document.getElementById("jdModal");
  var rows = document.querySelectorAll(".career-card[data-jd], .career-row[data-jd]");
  if (!overlay || !rows.length) return;

  var body = overlay.querySelector(".jdm-body");
  var closeBtn = overlay.querySelector(".jdm-close");
  var dialog = overlay.querySelector(".jdm-dialog");
  var lastFocus = null;

  function open(id) {
    var src = document.getElementById("jd-" + id);
    if (!src) return false;
    body.innerHTML = src.innerHTML;
    overlay.hidden = false;
    document.body.classList.add("jdm-open");
    if (dialog) dialog.scrollTop = 0;
    overlay.scrollTop = 0;
    closeBtn.focus();
    return true;
  }

  function close() {
    overlay.hidden = true;
    document.body.classList.remove("jdm-open");
    body.innerHTML = "";
    if (lastFocus) lastFocus.focus();
  }

  rows.forEach(function (r) {
    r.addEventListener("click", function (e) {
      var id = r.getAttribute("data-jd");
      if (!document.getElementById("jd-" + id)) return; // no inline JD -> follow the link
      e.preventDefault();
      lastFocus = r;
      open(id);
    });
  });

  overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
  closeBtn.addEventListener("click", close);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !overlay.hidden) close();
  });
})();
