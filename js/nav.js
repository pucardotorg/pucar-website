/* =========================================================
   PUCAR — shared header nav behaviour for GENERATED pages
   (job / contributor / about / team / sc-ai-policy pages;
   the homepage has its own copy of the glider in js/script.js
   and flips colours via story-beat :has() selectors instead).

   1. Glider: the sliding hover pill, same as the main page.
   2. body.nav-dark: toggled when the fixed header floats over
      a dark section (.collaborate variants, the footer), which
      drives the dark nav + logo flip in style.css.
   ========================================================= */
(function () {
  "use strict";
  var nav = document.querySelector(".site-header .site-nav");
  if (!nav) return;

  /* ---- glider ---- */
  var links = Array.prototype.slice.call(
    nav.querySelectorAll(":scope > a, :scope > .nav-drop > a")
  );
  if (links.length) {
    nav.classList.add("has-glider");
    var glider = document.createElement("span");
    glider.className = "nav-glider";
    glider.setAttribute("aria-hidden", "true");
    nav.insertBefore(glider, nav.firstChild);
    var lit = null;
    var move = function (a) {
      glider.style.left = a.offsetLeft + "px";
      glider.style.top = a.offsetTop + "px";
      glider.style.width = a.offsetWidth + "px";
      glider.style.height = a.offsetHeight + "px";
      glider.style.opacity = "1";
      if (lit) lit.classList.remove("is-lit");
      lit = a;
      a.classList.add("is-lit");
    };
    var clear = function () {
      glider.style.opacity = "0";
      if (lit) { lit.classList.remove("is-lit"); lit = null; }
    };
    links.forEach(function (a) {
      a.addEventListener("mouseenter", function () { move(a); });
      a.addEventListener("focus", function () { move(a); });
    });
    nav.addEventListener("mouseleave", clear);
    nav.addEventListener("focusout", function (e) {
      if (!nav.contains(e.relatedTarget)) clear();
    });
  }

  /* ---- home icon: visible only after scrolling down ---- */
  var homeShown = false;
  function homeCheck() {
    var want = window.scrollY > 200;
    if (want !== homeShown) {
      homeShown = want;
      nav.classList.toggle("show-home", want);
    }
  }
  window.addEventListener("scroll", homeCheck, { passive: true });
  homeCheck();

  /* ---- dark-section detection ---- */
  var darkSections = document.querySelectorAll(".collaborate, .site-footer");
  if (!darkSections.length) return;
  var ticking = false;
  function update() {
    ticking = false;
    var mid = 44; // roughly the header pill's vertical centre
    var dark = false;
    for (var i = 0; i < darkSections.length; i++) {
      var r = darkSections[i].getBoundingClientRect();
      if (r.top <= mid && r.bottom >= mid) { dark = true; break; }
    }
    document.body.classList.toggle("nav-dark", dark);
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  window.addEventListener("resize", update);
  update();
})();
