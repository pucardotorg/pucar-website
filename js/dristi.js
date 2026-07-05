/* =========================================================
   PUCAR — /dristi/ page
   1. State/district tabs (only Kerala/Kollam are live; the
      rest are disabled "coming soon" tabs, no JS needed).
   2. THE RACE: Kaplan-Meier resolution race across all 15
      Kerala districts (Jan 2025 cohort, day 417). Data and
      animation adapted from the user-supplied
      oncourts_overtake.html, re-themed to the site palette
      (green ON Court, pink rival, soft-orange Kerala line on
      the dark band). Plotly is loaded from CDN on this page
      only; everything no-ops gracefully if it fails.
   ========================================================= */
(function () {
  "use strict";
  var chartEl = document.getElementById("raceChart");
  if (!chartEl) return;

  /* ---- real data: KM estimates, Jan 2025 cohort ---- */
  var DAYS = [0, 15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240, 270, 300, 330, 365, 400];
  var RAW = {
    "ON Court (Kollam)":  [0, 0.09, 0.76, 2.53, 5.33, 7.45, 9.42, 10.48, 12.82, 15.18, 18.18, 21.93, 26.53, 30.68, 32.90, 35.09, 38.94, 44.48],
    "Malappuram":         [0, 11.22, 13.08, 13.68, 16.03, 17.85, 19.64, 20.35, 23.45, 24.62, 26.49, 30.24, 34.06, 37.01, 38.26, 38.26, 38.26, 38.26],
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
  var PINK = "#DA6EAA";        // --pink, the rival (Malappuram)
  var ORANGE = "#F0A28A";      // soft urgent tone, Kerala combined
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
    if (name === "Malappuram") return { color: PINK, width: 2.4 };
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
          { type: "line", x0: 359, x1: 359, y0: 0, y1: 50, line: { color: "rgba(48,207,140,.35)", width: 1.5, dash: "dot" } },
          { type: "line", x0: 297, x1: 410, y0: 38.26, y1: 38.26, line: { color: "rgba(218,110,170,.2)", width: 1, dash: "dot" } }
        ],
        annotations: [
          { x: 359, y: 38.4, text: "ON Court overtakes<br>Malappuram ~day 359", showarrow: true, arrowhead: 0,
            arrowcolor: GREEN, arrowwidth: 1.5, ax: 80, ay: -32, font: { size: 11, color: GREEN, family: FONT },
            bgcolor: "rgba(17,31,38,.92)", bordercolor: GREEN, borderwidth: 1, borderpad: 5 },
          { x: 405, y: 44.5, text: "<b>ON Court</b><br>44.5%", showarrow: false, font: { size: 11, color: GREEN, family: FONT },
            bgcolor: "rgba(48,207,140,.1)", bordercolor: "rgba(48,207,140,.3)", borderwidth: 1, borderpad: 4 },
          { x: 405, y: 38.26, text: "<b>Malappuram</b><br>38.3% (plateau)", showarrow: false, font: { size: 11, color: PINK, family: FONT },
            bgcolor: "rgba(218,110,170,.08)", bordercolor: "rgba(218,110,170,.25)", borderwidth: 1, borderpad: 4 }
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
    btn.addEventListener("click", function () {
      if (animating) return;
      animating = true;
      var flashFired = false;
      btn.textContent = "Racing…";
      btn.disabled = true;
      Plotly.relayout("raceChart", { shapes: [], annotations: [] });
      names.forEach(function (_, i) { Plotly.restyle("raceChart", { x: [[]], y: [[]] }, [i]); });
      updateRank(0);

      var totalMs = 5000;
      var start = performance.now();
      function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

      (function step(now) {
        var raw = Math.min(1, ((now || performance.now()) - start) / totalMs);
        var currentDay = ease(raw) * 410;
        var dayIdx = 0;
        for (var j = 0; j < DAYS.length; j++) if (DAYS[j] <= currentDay) dayIdx = j;
        updateRank(dayIdx);

        names.forEach(function (name, i) {
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
          Plotly.restyle("raceChart", { x: [xs], y: [ys] }, [i]);
        });

        if (!flashFired && currentDay >= 355) {
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
    });
  }
})();
