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
  var navs = Array.prototype.slice.call(document.querySelectorAll(".site-header .site-nav"));
  var nav = document.querySelector(".site-header .site-nav.main-nav") || navs[0];
  if (!nav) return;

  /* ---- main <-> page menu swap (pages with a sub-nav) ---- */
  var cluster = document.querySelector(".site-header .nav-cluster");
  if (cluster) {
    // FLIP the widths so the pills grow/shrink smoothly instead of snapping.
    // overflow:hidden is applied only DURING the animation -- permanently it
    // would clip the main nav's absolutely-positioned dropdown menus.
    function swapNavs(expand, collapse) {
      var e0 = expand.offsetWidth, c0 = collapse.offsetWidth;
      expand.classList.remove("is-collapsed");
      collapse.classList.add("is-collapsed");
      if (!expand.animate) return; // ancient browser: instant swap is fine
      var e1 = expand.offsetWidth, c1 = collapse.offsetWidth;
      var ease = "cubic-bezier(.4,.1,.2,1)";
      [ [expand, e0, e1], [collapse, c0, c1] ].forEach(function (job) {
        var el = job[0];
        el.style.overflow = "hidden";
        var anim = el.animate(
          [{ width: job[1] + "px" }, { width: job[2] + "px" }],
          { duration: 420, easing: ease }
        );
        anim.onfinish = function () { el.style.overflow = ""; };
      });
    }
    var mainNav = cluster.querySelector(".main-nav");
    var subNav = cluster.querySelector(".sub-nav");
    function expandNav(target) {
      if (!mainNav || !subNav || !target.classList.contains("is-collapsed")) return;
      if (target === mainNav) swapNavs(mainNav, subNav);
      else swapNavs(subNav, mainNav);
    }
    // HOVER expands (no click needed): a short hover-intent delay stops the
    // pills from swapping when the cursor merely passes across the burger
    var hoverT = null;
    [mainNav, subNav].forEach(function (n) {
      if (!n) return;
      n.addEventListener("mouseenter", function () {
        if (!n.classList.contains("is-collapsed")) return;
        clearTimeout(hoverT);
        hoverT = setTimeout(function () { expandNav(n); }, 140);
      });
      n.addEventListener("mouseleave", function () { clearTimeout(hoverT); });
    });
    // click still works (touch devices, keyboard via focus+enter)
    cluster.addEventListener("click", function (e) {
      var t = e.target.closest(".nav-toggle");
      if (!t) return;
      expandNav(t.getAttribute("data-nav") === "main" ? mainNav : subNav);
    });
    // sub-nav up-arrow: back to the top of the current page
    var topArrow = cluster.querySelector(".subnav-top");
    if (topArrow) {
      topArrow.addEventListener("click", function (e) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: "auto" });
      });
    }
  }

  /* ---- back pill: only when it actually goes somewhere on THIS site ----
     history.back() from a Google result / external link would bounce the
     visitor off the site, so the pill is removed unless the referrer is
     same-origin (works on the netlify subdomain today and pucar.org later,
     since it compares against location.origin dynamically). Direct visits
     (empty referrer) also drop it. Runs BEFORE the glider wires links. */
  var back = nav.querySelector(".nav-back");
  if (back) {
    var sameOrigin = false;
    try {
      sameOrigin = !!document.referrer &&
        new URL(document.referrer).origin === window.location.origin;
    } catch (e) { /* malformed referrer: treat as external */ }
    if (!sameOrigin) back.parentNode.removeChild(back);
  }

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

  /* ---- same sliding pill inside each dropdown menu ---- */
  Array.prototype.forEach.call(nav.querySelectorAll(".nav-menu"), function (menu) {
    var items = menu.querySelectorAll(".nav-menu-item");
    if (!items.length) return;
    menu.classList.add("has-glider");
    var mg = document.createElement("span");
    mg.className = "menu-glider";
    mg.setAttribute("aria-hidden", "true");
    menu.insertBefore(mg, menu.firstChild);
    var mlit = null;
    function mmove(a) {
      mg.style.left = a.offsetLeft + "px";
      mg.style.top = a.offsetTop + "px";
      mg.style.width = a.offsetWidth + "px";
      mg.style.height = a.offsetHeight + "px";
      mg.style.opacity = "1";
      if (mlit) mlit.classList.remove("is-lit");
      mlit = a;
      a.classList.add("is-lit");
    }
    function mclear() {
      mg.style.opacity = "0";
      if (mlit) { mlit.classList.remove("is-lit"); mlit = null; }
    }
    Array.prototype.forEach.call(items, function (a) {
      a.addEventListener("mouseenter", function () { mmove(a); });
      a.addEventListener("focus", function () { mmove(a); });
    });
    menu.addEventListener("mouseleave", mclear);
    menu.addEventListener("focusout", function (e) {
      if (!menu.contains(e.relatedTarget)) mclear();
    });
  });

  /* ---- home icon: always on for generated pages ----
     The homepage's own copy of this (js/script.js) still gates the up-arrow
     behind a 200px scroll -- that one only appears once there's actually
     somewhere to scroll back UP to. On every other page it's a plain link
     to "/", useful the moment the page loads, so it's shown immediately
     rather than waiting on a scroll threshold that made no sense here. */
  nav.classList.add("show-home");

  /* ---- About page: parallax bands (scroll-driven translate; ALL of them) ---- */
  var paras = Array.prototype.slice.call(document.querySelectorAll(".about-parallax-img"));
  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (paras.length && !reduceMotion) {
    var pTick = false;
    var paraUpdate = function () {
      pTick = false;
      paras.forEach(function (para) {
        var r = para.parentElement.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) return; // off-screen
        // -1 (band at bottom of viewport) .. +1 (band at top)
        var progress = 1 - 2 * ((r.top + r.height / 2) / window.innerHeight);
        // the layer has 20% headroom either side; use most of it
        para.style.transform = "translateY(" + (progress * r.height * 0.16) + "px)";
      });
    };
    window.addEventListener("scroll", function () {
      if (!pTick) { pTick = true; requestAnimationFrame(paraUpdate); }
    }, { passive: true });
    window.addEventListener("resize", paraUpdate);
    paraUpdate();
  }

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
