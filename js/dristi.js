/* =========================================================
   PUCAR — /dristi/ page
   1. State/district tabs (only Kerala/Kollam are live; the
      rest are disabled "coming soon" tabs, no JS needed).
   2. THE RACE: Kaplan-Meier resolution race across Kerala's
      districts (Jan 2025 cohort, day 417). Data and animation
      adapted from the user-supplied oncourts_overtake.html,
      re-themed to the site palette (green ON Court, soft-orange
      All Kerala line on the dark band; Malappuram removed on
      user request, 6 Jul 2026). Plotly is loaded from CDN on
      this page only; everything no-ops gracefully if it fails.
   ========================================================= */
/* ---- deployments: state tabs + district tabs + gliding map marker ----
   All states are clickable (6 Jul 2026). Kerala/Kollam shows the live
   body; every other district swaps in its coming-soon copy. Each state
   panel carries an inline SVG map; the district highlight (.km-d) and
   the dot (.km-marker) TRANSITION between districts via CSS. */
(function () {
  "use strict";
  var section = document.getElementById("deployments");
  if (!section) return;

  var stateTabs = section.querySelectorAll("[data-state-tab]");
  var rows = section.querySelectorAll("[data-state-row]");
  var panels = section.querySelectorAll("[data-state-panel]");

  function resizeCharts() {
    if (!window.Plotly) return;
    ["raceChart", "growthChart"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.offsetParent && el._fullLayout) Plotly.Plots.resize(el);
    });
  }

  stateTabs.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var key = btn.getAttribute("data-state-tab");
      stateTabs.forEach(function (b) { b.classList.toggle("is-active", b === btn); });
      rows.forEach(function (r) { r.hidden = r.getAttribute("data-state-row") !== key; });
      panels.forEach(function (p) { p.hidden = p.getAttribute("data-state-panel") !== key; });
      if (key === "kerala") setTimeout(resizeCharts, 60);
    });
  });

  /* ---- hover callout: elbowed leader line from the pulsing dot to a
     mouse-following label ("Kollam, Kerala"). Activates when the mouse
     comes within PAD px of the map, fades out when it leaves. Drawn in
     SVG viewBox units, so every size is scaled by sx (vb units per
     screen px) to render at constant screen size. ---- */
  var LABELS = {
    kollam: "Kollam, Kerala", thrissur: "Thrissur, Kerala",
    panchkula: "Panchkula, Haryana", gurgaon: "Gurgaon, Haryana",
    chandigarh: "Chandigarh", mohali: "Mohali, Punjab",
    ahmedabad: "Ahmedabad, Gujarat", rajkot: "Rajkot, Gujarat",
    vadodara: "Vadodara, Gujarat", surat: "Surat, Gujarat"
  };
  var NS = "http://www.w3.org/2000/svg";
  var PAD = 110; // activation distance around the map, in screen px

  section.querySelectorAll(".dristi-map").forEach(function (wrap) {
    var svg = wrap.querySelector("svg.state-map");
    var panel = wrap.closest(".dristi-panel");
    if (!svg || !panel) return;
    var g = document.createElementNS(NS, "g");
    g.setAttribute("class", "km-callout");
    var line = document.createElementNS(NS, "polyline");
    line.setAttribute("class", "km-lead");
    var box = document.createElementNS(NS, "rect");
    box.setAttribute("class", "km-tag-bg");
    var txt = document.createElementNS(NS, "text");
    txt.setAttribute("class", "km-tag");
    g.appendChild(line); g.appendChild(box); g.appendChild(txt);
    svg.appendChild(g);

    function hide() { g.classList.remove("is-on"); }

    panel.addEventListener("mousemove", function (e) {
      var r = svg.getBoundingClientRect();
      if (!r.width) { hide(); return; }
      if (e.clientX < r.left - PAD || e.clientX > r.right + PAD ||
          e.clientY < r.top - PAD || e.clientY > r.bottom + PAD) { hide(); return; }
      var act = svg.querySelector(".km-d.is-active");
      if (!act) { hide(); return; }
      var vb = svg.viewBox.baseVal;
      var sx = vb.width / r.width;
      var mx = vb.x + (e.clientX - r.left) * sx;
      var my = vb.y + (e.clientY - r.top) * (vb.height / r.height);
      var dx = +act.getAttribute("data-cx"), dy = +act.getAttribute("data-cy");

      txt.textContent = LABELS[act.getAttribute("data-d")] || "";
      var fs = 12.5 * sx;
      txt.setAttribute("font-size", fs);
      var tw = txt.getComputedTextLength();
      var padX = 8 * sx, h = fs + 12 * sx, w = tw + 2 * padX;

      var dir = mx >= dx ? 1 : -1;                 // label on the mouse's side of the dot
      var boxX = dir === 1 ? mx + 14 * sx : mx - 14 * sx - w;
      boxX = Math.max(vb.x + 2 * sx, Math.min(boxX, vb.x + vb.width - w - 2 * sx));
      var boxY = Math.max(vb.y + 2 * sx, Math.min(my - h / 2, vb.y + vb.height - h - 2 * sx));
      var anchorX = dir === 1 ? boxX : boxX + w;   // label edge the line plugs into
      var midY = boxY + h / 2;
      var elbowX = anchorX - dir * 12 * sx;        // dot -> diagonal -> short horizontal

      line.setAttribute("points", dx + "," + dy + " " + elbowX + "," + midY + " " + anchorX + "," + midY);
      line.setAttribute("stroke-width", 1.4 * sx);
      box.setAttribute("x", boxX); box.setAttribute("y", boxY);
      box.setAttribute("width", w); box.setAttribute("height", h);
      box.setAttribute("rx", 6 * sx);
      box.setAttribute("stroke-width", 1 * sx);
      txt.setAttribute("x", boxX + padX);
      txt.setAttribute("y", midY);
      g.classList.add("is-on");
    });
    panel.addEventListener("mouseleave", hide);
  });

  rows.forEach(function (row) {
    var panel = section.querySelector('[data-state-panel="' + row.getAttribute("data-state-row") + '"]');
    var isKerala = row.getAttribute("data-state-row") === "kerala";
    row.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-district]");
      if (!btn) return;
      var key = btn.getAttribute("data-district");
      row.querySelectorAll("[data-district]").forEach(function (b) {
        b.classList.toggle("is-active", b === btn);
      });
      /* copy blocks */
      panel.querySelectorAll("[data-dcopy]").forEach(function (c) {
        c.hidden = c.getAttribute("data-dcopy") !== key;
      });
      /* map: glide highlight + marker */
      var svg = panel.querySelector("svg.state-map");
      if (svg) {
        var target = null;
        svg.querySelectorAll(".km-d").forEach(function (p) {
          var on = p.getAttribute("data-d") === key;
          p.classList.toggle("is-active", on);
          if (on) target = p;
        });
        var marker = svg.querySelector(".km-marker");
        if (marker && target) {
          marker.style.transform = "translate(" + target.getAttribute("data-cx") + "px," + target.getAttribute("data-cy") + "px)";
        }
      }
      /* Kerala only: Kollam is live, everything else is coming soon */
      if (isKerala) {
        var live = panel.querySelector(".dristi-live-body");
        var soon = panel.querySelector(".dristi-soon-body");
        if (live) live.hidden = key !== "kollam";
        if (soon) soon.hidden = key === "kollam";
        if (key === "kollam") setTimeout(resizeCharts, 60);
      }
    });
  });
})();

/* ---- quarterly filings + disposals (public dashboard, July 2026) ----
   Static grouped bars in the site palette; independent of the race so
   either chart still renders if the other's element is missing. */
(function () {
  "use strict";
  var el = document.getElementById("growthChart");
  if (!el) return;

  var QUARTERS = ["Oct-Dec 24", "Jan-Mar 25", "Apr-Jun 25", "Jul-Sep 25", "Oct-Dec 25", "Jan-Mar 26", "Apr-Jun 26"];
  var FILED = [89, 245, 163, 246, 194, 461, 486];
  var DISPOSED = [0, 12, 37, 53, 105, 98, 88];

  var GREEN = "#30CF8C";
  var ORANGE = "#F0A28A";
  var GRID = "rgba(251,248,242,0.08)";
  var MUTED = "rgba(251,248,242,0.55)";
  var FONT = "'Source Sans 3', sans-serif";

  var tries = 0;
  (function waitPlotly() {
    if (window.Plotly) { init(); return; }
    if (++tries > 100) return; // CDN failed: the copy stands alone
    setTimeout(waitPlotly, 100);
  })();

  function init() {
    Plotly.newPlot(el, [
      { type: "bar", name: "Filed", x: QUARTERS, y: FILED,
        marker: { color: "rgba(48,207,140,.85)", line: { color: GREEN, width: 1 } },
        text: FILED.map(String), textposition: "outside", cliponaxis: false,
        textfont: { family: FONT, size: 12, color: GREEN },
        hovertemplate: "<b>Filed</b>: %{y}<extra></extra>" },
      { type: "bar", name: "Disposed", x: QUARTERS, y: DISPOSED,
        marker: { color: "rgba(240,162,138,.75)", line: { color: ORANGE, width: 1 } },
        text: DISPOSED.map(String), textposition: "outside", cliponaxis: false,
        textfont: { family: FONT, size: 12, color: ORANGE },
        hovertemplate: "<b>Disposed</b>: %{y}<extra></extra>" }
    ], {
      barmode: "group",
      bargap: 0.28,
      bargroupgap: 0.08,
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { family: FONT, color: MUTED },
      margin: { t: 8, r: 8, b: 44, l: 40 },
      xaxis: { tickfont: { size: 11 }, color: MUTED, fixedrange: true },
      yaxis: { title: { text: "Cases per quarter", font: { size: 12 } },
        range: [0, 545], /* headroom so the 486 label sits inside the plot */
        gridcolor: GRID, zeroline: false, tickfont: { size: 11 }, color: MUTED, fixedrange: true },
      legend: { orientation: "h", x: 0, y: 1.12, font: { size: 12, color: "rgba(251,248,242,.75)" } },
      hovermode: "x unified",
      hoverlabel: { bgcolor: "#111F26", bordercolor: "rgba(251,248,242,.25)", font: { family: FONT, size: 12, color: "#FBF8F2" } }
    }, { displayModeBar: false, responsive: true });
  }
})();

(function () {
  "use strict";
  var chartEl = document.getElementById("raceChart");
  if (!chartEl) return;

  /* ---- real data: KM estimates, Jan 2025 cohort ---- */
  var DAYS = [0, 15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240, 270, 300, 330, 365, 400];
  var RAW = {
    "ON Court (Kollam)":  [0, 0.09, 0.76, 2.53, 5.33, 7.45, 9.42, 10.48, 12.82, 15.18, 18.18, 21.93, 26.53, 30.68, 32.90, 35.09, 38.94, 44.48],
    /* Malappuram removed on user request (6 Jul 2026 sync) */
    "Pathanamthitta":     [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 33.33, 33.33, 33.33, 33.33],
    "Idukki":             [0, 0.26, 0.62, 1.00, 1.49, 1.67, 1.98, 2.82, 4.66, 8.84, 13.38, 15.55, 17.05, 19.34, 22.64, 24.00, 26.04, 31.55],
    "Rest of Kollam":     [0, 2.82, 2.99, 3.16, 3.33, 3.68, 4.63, 5.24, 5.51, 7.76, 8.30, 9.01, 10.32, 12.37, 15.69, 17.61, 18.99, 18.99],
    "Kozhikode":          [0, 0.35, 0.62, 0.85, 1.07, 1.35, 1.74, 2.56, 3.14, 4.51, 6.31, 8.98, 10.11, 11.35, 13.70, 17.28, 20.96, 21.67],
    "Wayanad":            [0, 2.66, 3.15, 3.64, 4.13, 4.62, 5.01, 5.40, 5.79, 6.58, 7.36, 8.15, 8.93, 8.96, 8.96, 8.96, 8.96, 8.96],
    "Alappuzha":          [0, 0.27, 1.59, 2.58, 3.21, 3.43, 3.66, 4.11, 4.46, 5.15, 6.26, 8.28, 11.52, 12.65, 14.01, 15.95, 15.95, 15.95],
    "Kannur":             [0, 0.44, 0.71, 1.01, 1.22, 1.29, 1.92, 2.72, 3.37, 4.76, 6.49, 7.71, 8.73, 10.30, 11.79, 13.49, 14.84, 15.80],
    "Kasaragod":          [0, 0.12, 0.24, 0.34, 0.45, 0.73, 0.82, 0.92, 1.03, 1.49, 3.19, 5.87, 6.80, 7.16, 10.45, 14.40, 16.48, 17.78],
    "Kottayam":           [0, 0.35, 0.56, 0.97, 1.76, 1.82, 1.89, 1.95, 2.06, 2.95, 3.57, 4.71, 5.66, 6.71, 7.75, 9.82, 11.82, 13.20],
    "Ernakulam":          [0, 0.48, 0.53, 0.70, 0.74, 0.90, 0.96, 1.11, 1.62, 2.49, 2.91, 3.86, 4.68, 5.80, 7.35, 8.55, 9.70, 10.40],
    "Kerala (Combined)":  [0, 0.38, 0.57, 0.89, 1.24, 1.47, 1.81, 2.15, 2.67, 3.57, 4.49, 5.49, 6.39, 7.34, 8.56, 9.68, 11.24, 12.49],
    "Thiruvananthapuram": [0, 0.33, 0.39, 0.57, 0.71, 0.86, 0.98, 1.08, 1.18, 2.08, 2.25, 2.40, 2.73, 3.03, 3.20, 3.63, 5.30, 5.30],
    "Palakkad":           [0, 0.49, 0.56, 0.64, 0.74, 0.85, 0.91, 0.96, 1.06, 1.21, 1.60, 1.93, 2.22, 2.22, 2.22, 2.22, 2.22, 2.22],
    "Thrissur":           [0, 0.13, 0.18, 0.24, 0.25, 0.27, 0.29, 0.32, 0.35, 0.42, 0.51, 0.63, 0.83, 1.11, 1.61, 1.94, 3.08, 3.92]
  };

  /* ---- site palette on the dark band ---- */
  var ON = "ON Court (Kollam)";
  var GREEN = "#30CF8C";       // --green, the ON Court line
  var ORANGE = "#F0A28A";      // soft urgent tone, the All Kerala line
  var DIM = "rgba(251,248,242,0.22)";
  var GRID = "rgba(251,248,242,0.08)";
  var MUTED = "rgba(251,248,242,0.55)";
  var FONT = "'Source Sans 3', sans-serif";

  var names = Object.keys(RAW);

  function rankAt(dayIdx) {
    var onVal = RAW[ON][dayIdx];
    var rank = 1;
    names.forEach(function (name) {
      if (name !== ON && RAW[name][dayIdx] > onVal) rank++;
    });
    return rank;
  }

  /* ---- rank pips ---- */
  var pipsEl = document.getElementById("racePips");
  var rankEl = document.getElementById("raceRank");
  var dayEl = document.getElementById("raceDay");
  for (var i = 0; i < names.length; i++) {
    var p = document.createElement("i");
    pipsEl.appendChild(p);
  }
  function updateRank(dayIdx) {
    var rank = rankAt(dayIdx);
    rankEl.textContent = "#" + rank;
    dayEl.textContent = "Day " + (DAYS[dayIdx] || 0);
    var pips = pipsEl.children;
    for (var i = 0; i < pips.length; i++) {
      var pipRank = pips.length - i;
      pips[i].className = pipRank >= rank ? "is-filled" : "";
    }
  }
  updateRank(0);

  /* ---- Plotly (CDN, deferred): retry briefly until it exists ---- */
  var tries = 0;
  (function waitPlotly() {
    if (window.Plotly) { init(); return; }
    if (++tries > 100) return; // CDN failed: stats + copy still stand alone
    setTimeout(waitPlotly, 100);
  })();

  function traceStyle(name) {
    if (name === ON) return { color: GREEN, width: 3.5 };
    if (name === "Kerala (Combined)") return { color: ORANGE, width: 1.8 };
    return { color: DIM, width: 1.2 };
  }

  function init() {
    var traces = names.map(function (name) {
      var st = traceStyle(name);
      return {
        type: "scatter", mode: "lines", name: name, x: [], y: [],
        line: { color: st.color, width: st.width, shape: "spline", smoothing: 0.45 },
        hovertemplate: "<b>" + name + "</b>: %{y:.2f}%<extra></extra>",
        showlegend: false
      };
    });
    var layout = {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { family: FONT, color: MUTED },
      margin: { t: 8, r: 16, b: 52, l: 46 },
      xaxis: { title: { text: "Days since filing", font: { size: 12 } }, range: [0, 410],
        gridcolor: GRID, zeroline: false, tickfont: { size: 11 }, color: MUTED },
      yaxis: { title: { text: "Cases resolved (%)", font: { size: 12 } }, range: [0, 50], ticksuffix: "%",
        gridcolor: GRID, zeroline: false, tickfont: { size: 11 }, color: MUTED },
      hovermode: "x unified",
      hoverlabel: { bgcolor: "#111F26", bordercolor: "rgba(251,248,242,.25)", font: { family: FONT, size: 12, color: "#FBF8F2" } },
      shapes: [], annotations: []
    };
    Plotly.newPlot("raceChart", traces, layout, { displayModeBar: false, responsive: true });

    function finalAnnotations() {
      Plotly.relayout("raceChart", {
        shapes: [
          // with Malappuram gone the last line ahead of the ON Court is
          // Pathanamthitta's late plateau; crossing is ~day 306
          { type: "line", x0: 306, x1: 306, y0: 0, y1: 50, line: { color: "rgba(48,207,140,.35)", width: 1.5, dash: "dot" } }
        ],
        annotations: [
          // xanchor:right keeps every label INSIDE the plot area (they used
          // to hang off the right edge of the chart)
          { x: 298, y: 44, text: "ON Court takes the lead<br>for good ~day 306", showarrow: false, xanchor: "right",
            font: { size: 11, color: GREEN, family: FONT },
            bgcolor: "rgba(17,31,38,.92)", bordercolor: GREEN, borderwidth: 1, borderpad: 5 },
          { x: 400, y: 47.5, text: "<b>ON Court</b> 44.5%", showarrow: false, xanchor: "right",
            font: { size: 11, color: GREEN, family: FONT },
            bgcolor: "rgba(48,207,140,.1)", bordercolor: "rgba(48,207,140,.3)", borderwidth: 1, borderpad: 4 },
          { x: 400, y: 12.5, text: "<b>All Kerala</b> 12.5%", showarrow: false, xanchor: "right",
            font: { size: 11, color: ORANGE, family: FONT },
            bgcolor: "rgba(17,31,38,.92)", bordercolor: "rgba(240,162,138,.35)", borderwidth: 1, borderpad: 4 }
        ]
      });
    }

    function showFull() {
      names.forEach(function (name, i) {
        Plotly.restyle("raceChart", { x: [DAYS], y: [RAW[name]] }, [i]);
      });
      finalAnnotations();
      updateRank(DAYS.length - 1);
    }
    showFull();

    /* ---- the animation ---- */
    var btn = document.getElementById("raceBtn");
    var flash = document.getElementById("raceFlash");
    var animating = false;

    /* big 3 - 2 - 1 - GO over an emptied grid before the lines move */
    var countEl = document.createElement("div");
    countEl.className = "race-count";
    countEl.setAttribute("aria-hidden", "true");
    chartEl.parentNode.insertBefore(countEl, chartEl.nextSibling);
    function countdown(done) {
      var steps = ["3", "2", "1", "GO"];
      var i = 0;
      (function tick() {
        if (i >= steps.length) { countEl.textContent = ""; countEl.classList.remove("is-on"); done(); return; }
        countEl.textContent = steps[i];
        countEl.classList.toggle("is-go", steps[i] === "GO");
        countEl.classList.remove("is-on");
        void countEl.offsetWidth; // restart the pop animation
        countEl.classList.add("is-on");
        i++;
        setTimeout(tick, steps[i - 1] === "GO" ? 550 : 700);
      })();
    }

    function runRace() {
      if (animating) return;
      animating = true;
      btn.textContent = "On your marks…";
      btn.disabled = true;
      // clear the grid FIRST so the countdown plays over an empty track
      Plotly.relayout("raceChart", { shapes: [], annotations: [] });
      var empty = names.map(function () { return []; });
      Plotly.restyle("raceChart", { x: empty, y: empty }, names.map(function (_, i) { return i; }));
      updateRank(0);
      countdown(startRun);
    }

    function startRun() {
      var flashFired = false;
      btn.textContent = "Racing…";
      Plotly.relayout("raceChart", { shapes: [], annotations: [] });
      updateRank(0);

      var totalMs = 5000;
      var start = performance.now();
      var allIdx = names.map(function (_, i) { return i; });
      function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

      (function step(now) {
        var raw = Math.min(1, ((now || performance.now()) - start) / totalMs);
        var currentDay = ease(raw) * 410;
        var dayIdx = 0;
        for (var j = 0; j < DAYS.length; j++) if (DAYS[j] <= currentDay) dayIdx = j;
        updateRank(dayIdx);

        // ONE restyle per frame for ALL traces (it was one call per trace
        // per frame, 16 relayouts a frame, which is what made it jitter)
        var xAll = [], yAll = [];
        names.forEach(function (name) {
          var xs = [], ys = [];
          for (var j = 0; j < DAYS.length; j++) {
            if (DAYS[j] <= currentDay) { xs.push(DAYS[j]); ys.push(RAW[name][j]); }
          }
          if (currentDay < 410 && xs.length < DAYS.length) {
            var lastJ = xs.length - 1, nextJ = lastJ + 1;
            var t = (currentDay - DAYS[lastJ]) / (DAYS[nextJ] - DAYS[lastJ]);
            xs.push(currentDay);
            ys.push(RAW[name][lastJ] + t * (RAW[name][nextJ] - RAW[name][lastJ]));
          }
          xAll.push(xs);
          yAll.push(ys);
        });
        Plotly.restyle("raceChart", { x: xAll, y: yAll }, allIdx);

        if (!flashFired && currentDay >= 302) {
          flashFired = true;
          flash.classList.add("show");
          setTimeout(function () { flash.classList.remove("show"); }, 2500);
        }

        if (raw < 1) {
          requestAnimationFrame(step);
        } else {
          finalAnnotations();
          updateRank(DAYS.length - 1);
          animating = false;
          btn.textContent = "↺ Replay";
          btn.disabled = false;
        }
      })(performance.now());
    }
    btn.addEventListener("click", runRace);

    /* auto-play ONCE when the CHART sits in the middle band of the screen
       (rootMargin trims 32% off the top and bottom, so intersection only
       begins when the chart is truly centred, not merely peeking in) */
    var played = false;
    if (window.IntersectionObserver) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting && !played) {
            played = true;
            io.disconnect();
            runRace(); // the countdown IS the settle time
          }
        });
      }, { rootMargin: "-32% 0px -32% 0px", threshold: 0.1 });
      io.observe(chartEl);
    }
  }
})();
