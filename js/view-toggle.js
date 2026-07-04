/* =========================================================
   PUCAR — cards ⇄ list view toggle
   Attaches a small grid/list switch to every known card grid
   (#collabGrid on the homepage, #perspGrid on /sc-ai-policy/,
   #contribGrid on /contributors/). List mode just adds
   .is-list to the grid; all the reshaping lives in style.css.
   The choice persists per-grid in localStorage.
   ========================================================= */
(function () {
  "use strict";

  var GRIDS = [
    { id: "collabGrid", bar: "collabFilters" },
    { id: "perspGrid", bar: null },
    { id: "contribGrid", bar: "contribFilters" }
  ];

  var ICONS = {
    grid: '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor"/><rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor"/><rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor"/><rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor"/></svg>',
    list: '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><rect x="1" y="2" width="14" height="3" rx="1.5" fill="currentColor"/><rect x="1" y="6.5" width="14" height="3" rx="1.5" fill="currentColor"/><rect x="1" y="11" width="14" height="3" rx="1.5" fill="currentColor"/></svg>'
  };

  GRIDS.forEach(function (cfg) {
    var grid = document.getElementById(cfg.id);
    if (!grid) return;
    var key = "pucar-view-" + cfg.id;

    var wrap = document.createElement("div");
    wrap.className = "view-toggle";
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", "Switch between card and list view");

    function makeBtn(mode, label) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "view-toggle-btn";
      b.dataset.mode = mode;
      b.setAttribute("aria-label", label);
      b.title = label;
      b.innerHTML = ICONS[mode];
      b.addEventListener("click", function () { setMode(mode, true); });
      return b;
    }
    var gridBtn = makeBtn("grid", "Card view");
    var listBtn = makeBtn("list", "List view");
    wrap.appendChild(gridBtn);
    wrap.appendChild(listBtn);

    function setMode(mode, persist) {
      grid.classList.toggle("is-list", mode === "list");
      gridBtn.setAttribute("aria-pressed", mode === "grid" ? "true" : "false");
      listBtn.setAttribute("aria-pressed", mode === "list" ? "true" : "false");
      gridBtn.classList.toggle("is-active", mode === "grid");
      listBtn.classList.toggle("is-active", mode === "list");
      if (persist) {
        try { localStorage.setItem(key, mode); } catch (e) { /* private mode */ }
      }
    }

    // mount: at the end of the section's filter bar when there is one,
    // otherwise in a right-aligned rail just above the grid
    var bar = cfg.bar && document.getElementById(cfg.bar);
    if (bar) {
      bar.appendChild(wrap);
      bar.hidden = false;
    } else {
      var rail = document.createElement("div");
      rail.className = "view-toggle-rail";
      rail.appendChild(wrap);
      grid.parentNode.insertBefore(rail, grid);
    }

    var saved = null;
    try { saved = localStorage.getItem(key); } catch (e) { /* ignore */ }
    setMode(saved === "list" ? "list" : "grid", false);
  });
})();
