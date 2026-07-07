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
      // one-shot: the items' fade-in animation is scoped to .just-in so it
      // can ONLY run right here, during a real expand (see style.css note)
      expand.classList.add("just-in");
      clearTimeout(expand.__justT);
      expand.__justT = setTimeout(function () { expand.classList.remove("just-in"); }, 500);
      if (!expand.animate) return; // ancient browser: instant swap is fine
      var e1 = expand.offsetWidth, c1 = collapse.offsetWidth;
      var ease = "cubic-bezier(.4,.1,.2,1)";
      // hover states are frozen while the pills move (is-swapping kills
      // pointer-events + gliders in CSS) so a highlight can't land on a
      // link that hasn't reached its final position yet
      cluster.classList.add("is-swapping");
      // belt-and-braces: onfinish never fires for CANCELLED animations
      // (e.g. rapid re-swaps), and a stuck is-swapping hides the gliders
      // with !important forever -- always release shortly after the FLIP
      clearTimeout(cluster.__swapT);
      cluster.__swapT = setTimeout(function () {
        cluster.classList.remove("is-swapping");
      }, 400);
      var pending = 2;
      [ [expand, e0, e1], [collapse, c0, c1] ].forEach(function (job) {
        var el = job[0];
        el.style.overflow = "hidden";
        var anim = el.animate(
          [{ width: job[1] + "px" }, { width: job[2] + "px" }],
          { duration: 160, easing: ease } // fast: the text waits for this to finish before fading in
        );
        anim.onfinish = function () {
          el.style.overflow = "";
          if (--pending === 0) cluster.classList.remove("is-swapping");
        };
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
      // only shown once there's something to scroll back UP to -- same
      // 200px gate (and the same width-reveal) as the homepage's arrow
      var topTick = false;
      var topUpdate = function () {
        topTick = false;
        subNav.classList.toggle("show-home", window.scrollY > 200);
      };
      window.addEventListener("scroll", function () {
        if (!topTick) { topTick = true; requestAnimationFrame(topUpdate); }
      }, { passive: true });
      topUpdate();
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

  /* ---- glider: on EVERY nav pill (main AND sub), so the sub-nav's hover
     highlight slides between links exactly like the main menu's ---- */
  var topLits = []; // every top-level nav's "currently lit" getter, wired below
  navs.forEach(function (n) {
    var links = Array.prototype.slice.call(
      n.querySelectorAll(":scope > a, :scope > .nav-drop > a")
    );
    if (!links.length) return;
    n.classList.add("has-glider");
    var glider = document.createElement("span");
    glider.className = "nav-glider";
    glider.setAttribute("aria-hidden", "true");
    n.insertBefore(glider, n.firstChild);
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
    n.addEventListener("mouseleave", clear);
    n.addEventListener("focusout", function (e) {
      if (!n.contains(e.relatedTarget)) clear();
    });
    // class flips (the sub-nav's show-home arrow reveal, the main<->page
    // menu swap) slide the links sideways under a glider parked at stale
    // pixel coordinates -- lit link turns into bare white text. Ride the
    // glider along for the transition's duration.
    var rideT = null;
    var ride = function () {
      var t0 = performance.now();
      cancelAnimationFrame(rideT);
      (function step() {
        if (lit) move(lit);
        if (performance.now() - t0 < 650) {
          rideT = requestAnimationFrame(step);
        } else if (lit && getComputedStyle(glider).opacity === "0") {
          // FAIL-SAFE: whatever hid the pill (lost transition, a stuck
          // is-swapping, anything unforeseen), a lit link with no pill
          // under it is unreadable -- drop the lit state entirely.
          clear();
        }
      })();
    };
    if (window.MutationObserver) {
      new MutationObserver(ride).observe(n, { attributes: true, attributeFilter: ["class"] });
    }
    // clicking a link: RESYNC FROM GROUND TRUTH. Whatever stale state the
    // jump/reveal leaves behind, we clear everything and re-light only if
    // the pointer is actually still on the link (checked again after the
    // layout has settled) -- a lit link without its pill is impossible.
    n.addEventListener("click", function (e) {
      var a = e.target.closest("a");
      // Only the top-level pills own this glider. A click on a dropdown
      // .nav-menu-item bubbles up to `n` too, and closest("a") returns that
      // item -- moving the main pill onto its (offset-parent-relative)
      // coordinates made the main highlight lurch toward the sub-menu on
      // click. Dropdown items have their own menu-glider; ignore them here.
      if (!a || links.indexOf(a) === -1) return;
      clear();
      setTimeout(function () {
        if (a.matches(":hover")) { move(a); ride(); } else { clear(); }
      }, 80);
      setTimeout(function () {
        if (lit && !lit.matches(":hover")) clear();
      }, 900);
    });
    // body.nav-dark (the dark-section colour flip) is set on <body>, not on
    // `n` -- the class-attribute observer just above never sees it, so a
    // link lit right as the page scrolls across a dark-section boundary
    // could be left with a stale-positioned glider under the new colour
    // scheme. Exposed here so the shared body-level watcher further down
    // can refresh it too.
    topLits.push(function () { if (lit) move(lit); });
  });

  /* ---- same sliding pill inside each dropdown menu ---- */
  var menuLits = []; // every dropdown's "currently lit" getter, for the fixes below
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
    // Same "stale pixel coordinates" class of bug as the top-level glider
    // above ("lit link turns into bare white text"), but this one was never
    // fixed for dropdown menus (user report: hovering/clicking an item in
    // the About/Community dropdown left it with its hover background gone
    // and the text unreadable). body.nav-dark flips the WHOLE colour
    // scheme (panel bg, default text, is-lit's text colour, the glider's
    // own bg) the instant it toggles, via pure CSS -- that part is fine.
    // What isn't fine: an item mid-hover already has its is-lit class (and
    // the JS-measured pixel position of mg) fixed from whenever mmove()
    // last ran. If nav-dark flips (scrolling into/out of a dark section
    // while a dropdown happens to be open) or a webfont finishes loading
    // and reflows the menu's text metrics AFTER mmove() already measured
    // it, the glider sits at the wrong offset while is-lit still forces a
    // colour meant to be read against it -- a background that's not where
    // the text is, is functionally "no background", and the text can end
    // up unreadable against the actual (now possibly re-coloured) panel.
    // Re-measuring the currently-lit item keeps it glued to the right spot
    // and colour regardless of what caused the reflow.
    menuLits.push(function () { if (mlit) mmove(mlit); });
  });

  /* ---- refresh every glider after whatever might have moved things ----
     Re-run for 600ms (matches the existing per-nav "ride" mechanism above)
     whenever body's classes change (nav-dark flips colour AND, via the
     is-collapsed swap, layout) or once webfonts finish loading (Fraunces/
     Source Sans swapping in reflows text metrics after gliders were first
     measured against the fallback font). */
  function rideAll() {
    var t0 = performance.now();
    (function ride() {
      menuLits.forEach(function (fn) { fn(); });
      topLits.forEach(function (fn) { fn(); });
      if (performance.now() - t0 < 600) requestAnimationFrame(ride);
    })();
  }
  if (window.MutationObserver) {
    new MutationObserver(rideAll).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(rideAll);
  }

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
  var darkSections = document.querySelectorAll(".collaborate, .site-footer, .policy-band, .cp-darkzone");
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
