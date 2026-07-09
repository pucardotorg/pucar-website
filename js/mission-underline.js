/* Hand-inked underlines under the mission statement's <em> accents.
   Draws a wobbly, pen-like stroke under each accent word and animates it
   in when the section scrolls into view. Wrap-safe: measures each line box
   of an <em> separately (getClientRects) so a phrase that wraps still gets
   a clean stroke per line. Purely decorative — layered behind the text,
   pointer-events off, and skipped for prefers-reduced-motion (drawn static).*/
(function () {
  var SVGNS = 'http://www.w3.org/2000/svg';
  var stmt = document.getElementById('missionStatement');
  if (!stmt) return;

  var reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* small deterministic PRNG so each word's squiggle is stable across
     resizes (it doesn't re-roll and jump around) but differs word to word */
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  var overlay = null;
  var paths = [];
  var drawn = false;

  /* one hand-drawn stroke spanning x0..x1 at vertical y, jittered by r() */
  function handPath(x0, x1, y, r) {
    var padL = 5 + r() * 7;              // pen starts a touch before the word
    var padR = 5 + r() * 9;              // ...and overshoots a touch after
    x0 -= padL; x1 += padR;
    var len = x1 - x0;
    var base = y + 3 + r() * 2;          // sit just under the baseline
    var slant = (r() - 0.5) * 5;         // slight overall tilt
    var drift = (r() - 0.5) * 3;         // whole-stroke vertical drift
    var segs = Math.max(4, Math.round(len / 26));
    var px = x0, py = base + drift;
    var d = 'M' + px.toFixed(1) + ',' + py.toFixed(1);
    for (var i = 1; i <= segs; i++) {
      var t = i / segs;
      var x = x0 + len * t + (r() - 0.5) * 4;      // uneven horizontal steps
      var yv = base + drift + slant * t + (r() - 0.5) * 3.6;  // wobble
      var cx = px + (x - px) * 0.5 + (r() - 0.5) * 7;
      var cy = py + (yv - py) * 0.5 + (r() - 0.5) * 6;
      d += ' Q' + cx.toFixed(1) + ',' + cy.toFixed(1) +
           ' ' + x.toFixed(1) + ',' + yv.toFixed(1);
      px = x; py = yv;
    }
    /* a little upward flick where the pen leaves the paper */
    d += ' q' + (4 + r() * 4).toFixed(1) + ',' + (-(2 + r() * 4)).toFixed(1) +
         ' ' + (6 + r() * 5).toFixed(1) + ',' + (-(1 + r() * 3)).toFixed(1);
    return d;
  }

  function build() {
    if (overlay) { overlay.remove(); overlay = null; }
    paths = [];
    var ems = stmt.querySelectorAll('em');
    if (!ems.length) return;

    var W = stmt.offsetWidth, H = stmt.offsetHeight;
    var sBox = stmt.getBoundingClientRect();

    overlay = document.createElementNS(SVGNS, 'svg');
    overlay.setAttribute('class', 'mission-ink');
    overlay.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    overlay.setAttribute('width', W);
    overlay.setAttribute('height', H);
    overlay.setAttribute('aria-hidden', 'true');

    /* roughen filter: nudges the stroke edges so a tidy path reads as ink */
    var defs = document.createElementNS(SVGNS, 'defs');
    defs.innerHTML =
      '<filter id="missionInkRoughen" x="-6%" y="-40%" width="112%" height="180%">' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.9 0.6" numOctaves="1" seed="4" result="n"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G"/>' +
      '</filter>';
    overlay.appendChild(defs);

    var g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('filter', 'url(#missionInkRoughen)');
    overlay.appendChild(g);

    for (var e = 0; e < ems.length; e++) {
      var rects = ems[e].getClientRects();
      var r = rng(e * 131 + 17);
      for (var i = 0; i < rects.length; i++) {
        var b = rects[i];
        if (b.width < 6) continue;
        var d = handPath(
          b.left - sBox.left,
          b.right - sBox.left,
          b.bottom - sBox.top,
          r
        );
        var p = document.createElementNS(SVGNS, 'path');
        p.setAttribute('d', d);
        p.setAttribute('class', 'mission-ink-stroke');
        g.appendChild(p);
        paths.push(p);
      }
    }

    stmt.appendChild(overlay);

    for (var k = 0; k < paths.length; k++) {
      var L = paths[k].getTotalLength();
      paths[k].style.strokeDasharray = L;
      paths[k].style.strokeDashoffset = (reduce || drawn) ? 0 : L;
    }
  }

  function draw() {
    if (drawn) return;
    drawn = true;
    for (var k = 0; k < paths.length; k++) {
      (function (p, idx) {
        setTimeout(function () {
          p.style.transition = 'stroke-dashoffset .6s cubic-bezier(.4,.0,.2,1)';
          p.style.strokeDashoffset = 0;
        }, 140 * idx);
      })(paths[k], k);
    }
  }

  function start() {
    build();
    if (reduce) return;
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) { draw(); io.disconnect(); break; }
        }
      }, { threshold: 0.45 });
      io.observe(stmt);
    } else {
      draw();
    }
  }

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(build, 180);   // recompute geometry; keeps drawn state
  });

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(start);
  } else {
    window.addEventListener('load', start);
  }
})();
