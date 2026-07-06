/* =========================================================
   PUCAR — "Where we're building" interactive India map.

   Data: window.INDIA_MAP (js/india-map-data.js), projected from the
   same Indian shapefile source (datta07) as the DRISTI state maps, one
   consistent equirectangular projection so the national outline and the
   per-state district shapes share a coordinate space (viewBox 897x1000).
   India is shown with the full official boundary — J&K + Ladakh cover
   PoK, Gilgit-Baltistan and Aksai Chin.

   Behaviour:
   - ALL-INDIA view: every state filled green (active states brighter),
     a pink court dot per active REGION (Kerala / Punjab & Haryana /
     Gujarat), no districts.
   - Click a row on the left, or any state on the map, and the map
     tweens (viewBox) to lift + enlarge that state/region: the region's
     districts fade in with their internal borders, and the dots become
     per-COURT district dots. Coming-soon regions say so.
   - Back to "All India" resets everything.

   Dependency-free, matches the site's dark collaborate-band styling.
   ========================================================= */
(function () {
  "use strict";
  var host = document.getElementById("reachMap");
  var listHost = document.getElementById("reachList");
  var D = window.INDIA_MAP;
  if (!host || !listHost || !D) return;

  var SVGNS = "http://www.w3.org/2000/svg";
  var W = D.vb[0], H = D.vb[1];
  var ACTIVE = {};                 // state name -> region id
  D.regions.forEach(function (r) { r.states.forEach(function (s) { ACTIVE[s] = r.id; }); });
  var regionById = {};
  D.regions.forEach(function (r) { regionById[r.id] = r; });

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- build the SVG ---------- */
  function el(name, attrs) {
    var e = document.createElementNS(SVGNS, name);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  var svg = el("svg", { viewBox: "0 0 " + W + " " + H, class: "reach-svg", role: "img",
    "aria-label": "Map of India showing where PUCAR's courts are live and coming soon" });

  var gZoom = el("g", { class: "rm-zoom" });
  var gStates = el("g", { class: "rm-states" });
  var stateEls = {};
  D.states.forEach(function (s) {
    var p = el("path", { d: s.d, class: "rm-state" + (ACTIVE[s.n] ? " is-live" : ""),
      "data-state": s.n, "vector-effect": "non-scaling-stroke" });
    if (ACTIVE[s.n]) p.setAttribute("data-region", ACTIVE[s.n]);
    stateEls[s.n] = p;
    gStates.appendChild(p);
  });
  gZoom.appendChild(gStates);

  // per-region district layers (hidden until the region is active)
  var regionLayers = {};
  D.regions.forEach(function (r) {
    var g = el("g", { class: "rm-districts", "data-region": r.id });
    g.style.opacity = "0";
    g.style.pointerEvents = "none";
    r.districts.forEach(function (d) {
      // a district is a "court" district if its centroid matches one of the
      // region's court centroids (same source, so an exact match) -> it gets
      // the green DRISTI active-district treatment
      var isCourt = r.courts.some(function (c) {
        return c.c && d.c && c.c[0] === d.c[0] && c.c[1] === d.c[1];
      });
      var p = el("path", { d: d.d, class: "rm-district" + (isCourt ? " is-court" : ""),
        "data-name": d.n, "vector-effect": "non-scaling-stroke" });
      g.appendChild(p);
    });
    regionLayers[r.id] = g;
    gZoom.appendChild(g);
  });
  svg.appendChild(gZoom);

  // dots overlay (kept in the same coord space; radius rescaled per frame
  // so dots stay a constant SCREEN size at any zoom)
  var gDots = el("g", { class: "rm-dots" });
  svg.appendChild(gDots);

  // floating label
  var tip = document.createElement("div");
  tip.className = "rm-tip";
  tip.setAttribute("aria-hidden", "true");

  host.appendChild(svg);
  host.appendChild(tip);

  /* ---------- viewBox tween ---------- */
  var full = { x: 0, y: 0, w: W, h: H };
  var view = { x: 0, y: 0, w: W, h: H };
  var anim = null;
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function padBox(b, padFrac) {
    var pw = b[2] * padFrac, ph = b[3] * padFrac;
    var x = b[0] - pw, y = b[1] - ph, w = b[2] + pw * 2, h = b[3] + ph * 2;
    // keep the map aspect ratio so nothing squashes
    var ar = W / H;
    if (w / h > ar) { var nh = w / ar; y -= (nh - h) / 2; h = nh; }
    else { var nw = h * ar; x -= (nw - w) / 2; w = nw; }
    return { x: x, y: y, w: w, h: h };
  }

  function applyView(v) {
    svg.setAttribute("viewBox", v.x + " " + v.y + " " + v.w + " " + v.h);
    // dot radius/stroke scale with the current zoom so they look constant
    var k = v.w / W;
    gDots.querySelectorAll(".rm-dot").forEach(function (c) {
      c.setAttribute("r", (7.5 * k));
    });
    gDots.querySelectorAll(".rm-ping").forEach(function (c) {
      c.setAttribute("r", (7.5 * k));
      c.style.setProperty("--ping-r", (7.5 * k) + "px");
    });
  }

  function tweenTo(target, ms) {
    if (anim) cancelAnimationFrame(anim);
    if (reduce) { view = { x: target.x, y: target.y, w: target.w, h: target.h }; applyView(view); return; }
    var from = { x: view.x, y: view.y, w: view.w, h: view.h };
    var t0 = performance.now();
    (function step(now) {
      var t = Math.min(1, (now - t0) / ms);
      var e = easeOutCubic(t);
      view.x = from.x + (target.x - from.x) * e;
      view.y = from.y + (target.y - from.y) * e;
      view.w = from.w + (target.w - from.w) * e;
      view.h = from.h + (target.h - from.h) * e;
      applyView(view);
      if (t < 1) anim = requestAnimationFrame(step);
    })(t0);
  }

  /* ---------- dots ---------- */
  function clearDots() { while (gDots.firstChild) gDots.removeChild(gDots.firstChild); }
  function addDot(cx, cy, live, label) {
    if (cx == null) return;
    var k = view.w / W;
    if (!reduce) { // every dot pulses (live and coming-soon)
      var ping = el("circle", { class: "rm-ping", cx: cx, cy: cy, r: 7.5 * k, "vector-effect": "non-scaling-stroke" });
      gDots.appendChild(ping);
    }
    var dot = el("circle", { class: "rm-dot" + (live ? " is-live" : ""), cx: cx, cy: cy, r: 7.5 * k, "vector-effect": "non-scaling-stroke" });
    if (label) {
      dot.addEventListener("mouseenter", function () { showTip(label, cx, cy); });
      dot.addEventListener("mouseleave", hideTip);
    }
    gDots.appendChild(dot);
  }
  function nationalDots() {
    clearDots();
    D.regions.forEach(function (r) {
      if (r.dot) addDot(r.dot[0], r.dot[1], r.live, r.label + (r.live ? " — live" : " — coming soon"));
    });
  }
  function regionDots(r) {
    clearDots();
    r.courts.forEach(function (c) {
      if (c.c) addDot(c.c[0], c.c[1], c.live, c.n + (c.live ? " — live" : " — coming soon"));
    });
  }

  /* ---------- tooltip ---------- */
  function showTip(text, cx, cy) {
    tip.textContent = text;
    // convert viewBox coords to host-pixel coords
    var rect = svg.getBoundingClientRect();
    var px = (cx - view.x) / view.w * rect.width;
    var py = (cy - view.y) / view.h * rect.height;
    tip.style.left = px + "px";
    tip.style.top = py + "px";
    tip.classList.add("is-on");
  }
  function hideTip() { tip.classList.remove("is-on"); }

  /* ---------- selection ---------- */
  var current = "all";
  function selectAll() {
    current = "all";
    D.regions.forEach(function (r) {
      var g = regionLayers[r.id];
      g.style.opacity = "0"; g.style.pointerEvents = "none";
    });
    svg.classList.remove("is-zoomed");
    for (var n in stateEls) stateEls[n].classList.remove("is-faded", "is-selected");
    tweenTo(full, 760);
    nationalDots();
    setRowActive("all");
    hideTip();
  }

  function selectRegion(id) {
    var r = regionById[id];
    if (!r) return;
    current = id;
    svg.classList.add("is-zoomed");
    // fade every state except the ones in this region; hide this region's
    // solid state fill so its districts (with borders) read instead
    for (var n in stateEls) {
      var inReg = r.states.indexOf(n) !== -1;
      stateEls[n].classList.toggle("is-faded", !inReg);
      stateEls[n].classList.toggle("is-selected", inReg);
    }
    D.regions.forEach(function (rr) {
      var g = regionLayers[rr.id];
      var on = rr.id === id;
      g.style.opacity = on ? "1" : "0";
      g.style.pointerEvents = on ? "auto" : "none";
    });
    tweenTo(padBox(r.b, 0.28), 820);
    // dots fade/settle after the zoom reads
    setTimeout(function () { if (current === id) regionDots(r); }, reduce ? 0 : 120);
    setRowActive(id);
    pingCard(id);   // clicking a state on the map lands you on its card
    hideTip();
  }

  // clicking a NON-active state: lift it with a coming-soon note
  function selectState(name) {
    if (ACTIVE[name]) { selectRegion(ACTIVE[name]); return; }
    var s = D.states.find(function (x) { return x.n === name; });
    if (!s) return;
    current = "state:" + name;
    svg.classList.add("is-zoomed");
    for (var n in stateEls) {
      stateEls[n].classList.toggle("is-faded", n !== name);
      stateEls[n].classList.toggle("is-selected", n === name);
    }
    D.regions.forEach(function (rr) { regionLayers[rr.id].style.opacity = "0"; });
    tweenTo(padBox(s.b, 0.3), 820);
    clearDots();
    setRowActive(null);
    setTimeout(function () {
      if (current === "state:" + name) showTip(titleCase(name) + " — coming soon", s.c[0], s.c[1]);
    }, reduce ? 0 : 300);
  }

  /* ---------- left-hand rows ---------- */
  var rows = {};
  function stateByName(n) { return D.states.find(function (s) { return s.n === n; }); }
  // a tiny silhouette of the row's state(s), reusing the same map paths so
  // the card visually echoes the region it selects
  function thumbHTML(id) {
    var vb, paths;
    if (id === "all") {
      vb = [0, 0, W, H];
      paths = D.states.map(function (s) {
        return '<path d="' + s.d + '" class="rm-th' + (ACTIVE[s.n] ? " is-live" : "") + '"/>';
      }).join("");
    } else {
      var r = regionById[id], b = r.b, pad = Math.max(b[2], b[3]) * 0.14;
      vb = [b[0] - pad, b[1] - pad, b[2] + pad * 2, b[3] + pad * 2];
      paths = r.states.map(function (n) {
        var s = stateByName(n);
        return s ? '<path d="' + s.d + '" class="rm-th is-live"/>' : "";
      }).join("");
    }
    return '<svg viewBox="' + vb.join(" ") + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' + paths + "</svg>";
  }
  function makeRow(id, label, sub, live) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "rm-row" + (id === "all" ? " is-all" : "");
    b.setAttribute("data-row", id);
    var live_html = live ? '<span class="rm-live"><span class="rm-live-dot"></span>Live</span>'
      : (id === "all" ? '<span class="rm-count"></span>' : '<span class="rm-soon">Coming soon</span>');
    b.innerHTML =
      '<span class="rm-thumb">' + thumbHTML(id) + "</span>" +
      '<span class="rm-row-main"><span class="rm-row-label">' + label + "</span>" +
      (sub ? '<span class="rm-row-sub">' + sub + "</span>" : "") + "</span>" +
      live_html;
    b.addEventListener("click", function () {
      if (id === "all") selectAll(); else selectRegion(id);
    });
    b.addEventListener("mouseenter", function () {
      if (id !== "all" && current === "all") {
        var r = regionById[id];
        r.states.forEach(function (n) { if (stateEls[n]) stateEls[n].classList.add("is-hover"); });
      }
    });
    b.addEventListener("mouseleave", function () {
      for (var n in stateEls) stateEls[n].classList.remove("is-hover");
    });
    rows[id] = b;
    listHost.appendChild(b);
  }
  function setRowActive(id) {
    for (var k in rows) rows[k].classList.toggle("is-active", k === id);
  }
  // pulse the matching card and bring it into view (map click -> its section)
  function pingCard(id) {
    var c = rows[id];
    if (!c) return;
    c.classList.remove("is-pinged");
    void c.offsetWidth;
    c.classList.add("is-pinged");
    if (c.scrollIntoView) c.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  makeRow("all", "All India", "Every state we're building toward", null);
  D.regions.forEach(function (r) { makeRow(r.id, r.label, r.sub, r.live); });

  /* ---------- state click/hover on the map ---------- */
  D.states.forEach(function (s) {
    var p = stateEls[s.n];
    p.style.cursor = "pointer";
    p.addEventListener("click", function () { selectState(s.n); });
  });
  // only the court districts are interactive — no hover on districts we're
  // not active in
  D.regions.forEach(function (r) {
    regionLayers[r.id].querySelectorAll(".rm-district.is-court").forEach(function (p) {
      p.addEventListener("mouseenter", function () {
        var nm = p.getAttribute("data-name");
        var box = p.getBBox();
        showTip(titleCase(nm), box.x + box.width / 2, box.y + box.height / 2);
      });
      p.addEventListener("mouseleave", hideTip);
    });
  });

  function titleCase(s) {
    return s.toLowerCase().replace(/\b\w/g, function (c) { return c.toUpperCase(); })
      .replace(/&/g, "&").replace(/\bNag\*$/, "Nagar");
  }

  // keep the tooltip glued while resizing
  window.addEventListener("resize", function () { if (tip.classList.contains("is-on")) hideTip(); });

  // start in the all-India view
  applyView(view);
  nationalDots();
  setRowActive("all");
})();
