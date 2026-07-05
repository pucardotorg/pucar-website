/* =========================================================
   PUCAR — /resources/ page behaviour
   1. Blog: topic pill filter.
   2. Data, Policy, Research and more: tabs (All + three
      initiatives) with a per-tab description swap.
   3. Learning circles: cards open a minimal video modal
      (YouTube embed + description, nothing more).
   ========================================================= */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var EXIT_MS = 260; // matches .card-exit's opacity/transform transition

  /* ---- animated filtering, same FLIP recipe as collaborate.js ----
     Instead of instantly flipping `hidden` (cards popping in, the grid
     snapping shut), leaving cards get pinned absolute at their old spot and
     fade/shrink out (.card-exit), surviving cards get inverse-transformed
     then released so they SLIDE into their new slot, and entering cards
     fade/scale in at their real slot. All resource cards are .collab-card,
     so the .card-exit CSS + the card's own transform/opacity transitions
     already apply; .collab-grid is position:relative (the pin's containing
     block). prefers-reduced-motion falls back to the instant version. */
  function animateFilter(grid, cards, matches) {
    if (reduceMotion) {
      cards.forEach(function (c) { c.hidden = !matches(c); });
      clampAll();
      return;
    }
    var gridRect = grid.getBoundingClientRect();
    var firstRects = new Map();
    cards.forEach(function (c) {
      if (!c.hidden) firstRects.set(c, c.getBoundingClientRect());
    });

    var entering = [], exiting = [];
    cards.forEach(function (c) {
      if (matches(c)) {
        if (c.hidden) { c.hidden = false; entering.push(c); }
        c.classList.remove("card-exit");
      } else if (!c.hidden) {
        exiting.push(c);
      }
    });

    // pin exiting cards where they are so the grid reflows under them now
    exiting.forEach(function (c) {
      var r = firstRects.get(c);
      if (!r) return;
      c.style.position = "absolute";
      c.style.left = (r.left - gridRect.left) + "px";
      c.style.top = (r.top - gridRect.top) + "px";
      c.style.width = r.width + "px";
      c.classList.add("card-exit");
    });

    // everyone else's NEW slot, with the exiting cards out of flow
    var lastRects = new Map();
    cards.forEach(function (c) {
      if (c.hidden || exiting.indexOf(c) !== -1) return;
      lastRects.set(c, c.getBoundingClientRect());
    });

    cards.forEach(function (c) {
      if (entering.indexOf(c) !== -1 || exiting.indexOf(c) !== -1) return;
      var first = firstRects.get(c), last = lastRects.get(c);
      if (!first || !last) return;
      var dx = first.left - last.left, dy = first.top - last.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      c.style.transition = "none";
      c.style.transform = "translate(" + dx + "px," + dy + "px)";
    });
    entering.forEach(function (c) {
      c.style.transition = "none";
      c.style.opacity = "0";
      c.style.transform = "scale(.95)";
    });

    void grid.offsetHeight; // flush the "from" styles before releasing them

    requestAnimationFrame(function () {
      cards.forEach(function (c) {
        if (exiting.indexOf(c) !== -1) return;
        c.style.transition = "";
        c.style.transform = "";
        c.style.opacity = "";
      });
    });

    exiting.forEach(function (c) {
      setTimeout(function () {
        if (!c.classList.contains("card-exit")) return; // re-matched meanwhile
        c.hidden = true;
        c.classList.remove("card-exit");
        c.style.position = "";
        c.style.left = "";
        c.style.top = "";
        c.style.width = "";
      }, EXIT_MS);
    });

    clampAll(); // newly-revealed cards need their chip rows measured
  }

  /* ---- show-more capping ----
     Every section shows at most 2 rows of cards (5 rows in list view); the
     rest of the CURRENT FILTER MATCH hides behind a centered "Show N more"
     button injected after the grid (toggles to "Show less"). The cap is
     recomputed from the grid's resolved column count, so it tracks the
     responsive layout; filters and the cards/list toggle re-apply it. */
  var CARD_ROWS = 2, LIST_ROWS = 5;
  var sections = [];

  function gridCols(grid) {
    var t = (getComputedStyle(grid).gridTemplateColumns || "").trim();
    // browsers resolve to a px track list ("331px 331px 331px"); anything
    // else ("none", authored repeat() in jsdom) falls back to 3
    if (t.indexOf("px") !== -1 && t.indexOf("repeat") === -1) {
      var n = t.split(/\s+/).length;
      if (n > 0) return n;
    }
    return 3;
  }
  function capFor(sec) {
    return sec.grid.classList.contains("is-list") ? LIST_ROWS : gridCols(sec.grid) * CARD_ROWS;
  }
  function renderSection(sec, animate) {
    var matched = sec.cards.filter(sec.match);
    var cap = capFor(sec);
    var visible = sec.expanded ? matched : matched.slice(0, cap);
    var allow = new Set(visible);
    var pred = function (c) { return allow.has(c); };
    if (animate) {
      animateFilter(sec.grid, sec.cards, pred);
    } else {
      sec.cards.forEach(function (c) { c.hidden = !allow.has(c); });
      clampAll();
    }
    if (!sec.btn) {
      sec.btnWrap = document.createElement("div");
      sec.btnWrap.className = "res-more";
      sec.btn = document.createElement("button");
      sec.btn.type = "button";
      sec.btn.className = "res-more-btn";
      sec.btnWrap.appendChild(sec.btn);
      sec.grid.parentNode.insertBefore(sec.btnWrap, sec.grid.nextSibling);
      sec.btn.addEventListener("click", function () {
        sec.expanded = !sec.expanded;
        renderSection(sec, true);
      });
    }
    if (sec.expanded) {
      sec.btnWrap.hidden = matched.length <= cap; // nothing left to collapse
      sec.btn.textContent = "Show less";
    } else {
      var extra = matched.length - visible.length;
      sec.btnWrap.hidden = extra <= 0;
      sec.btn.textContent = "Show " + extra + " more";
    }
  }
  function registerSection(grid, cards, match) {
    var sec = { grid: grid, cards: cards, match: match, expanded: false, btn: null };
    sections.push(sec);
    renderSection(sec, false);
    // the cards/list toggle flips .is-list on the grid: re-cap when it does
    if (window.MutationObserver) {
      new MutationObserver(function () { renderSection(sec, false); })
        .observe(grid, { attributes: true, attributeFilter: ["class"] });
    }
    return sec;
  }
  var moreT;
  window.addEventListener("resize", function () { // column count can change
    clearTimeout(moreT);
    moreT = setTimeout(function () {
      sections.forEach(function (s) { renderSection(s, false); });
    }, 250);
  });

  /* ---- blog topic filter ---- */
  var tagbar = document.getElementById("blogTagbar");
  var blogGrid = document.getElementById("blogGrid");
  if (tagbar && blogGrid) {
    var blogCards = Array.prototype.slice.call(blogGrid.querySelectorAll(".res-card"));
    var blogTag = "all";
    var blogSec = registerSection(blogGrid, blogCards, function (card) {
      var tags = (card.getAttribute("data-tags") || "").split("|");
      return blogTag === "all" || tags.indexOf(blogTag) !== -1;
    });
    tagbar.addEventListener("click", function (e) {
      var btn = e.target.closest(".res-tab");
      if (!btn) return;
      tagbar.querySelectorAll(".res-tab").forEach(function (b) { b.classList.remove("is-active"); });
      btn.classList.add("is-active");
      blogTag = btn.getAttribute("data-tag");
      renderSection(blogSec, true);
    });
  }

  /* ---- leaving-site warning for blog links (new tab, themed modal) ---- */
  var leave = document.getElementById("leaveModal");
  if (leave && blogGrid) {
    var lmHost = document.getElementById("lmHost");
    var lmGo = document.getElementById("lmGo");
    var pendingUrl = "";
    blogGrid.addEventListener("click", function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // power users skip the prompt
      var card = e.target.closest("a.res-card");
      if (!card) return;
      e.preventDefault();
      pendingUrl = card.href;
      try { lmHost.textContent = new URL(pendingUrl).hostname.replace(/^www\./, ""); }
      catch (err) { lmHost.textContent = "another site"; }
      leave.hidden = false;
      document.body.classList.add("modal-open");
    });
    function closeLeave() {
      leave.hidden = true;
      document.body.classList.remove("modal-open");
    }
    lmGo.addEventListener("click", function () {
      window.open(pendingUrl, "_blank", "noopener");
      closeLeave();
    });
    leave.addEventListener("click", function (e) {
      if (e.target.hasAttribute && e.target.hasAttribute("data-close")) closeLeave();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !leave.hidden) closeLeave();
    });
  }

  /* ---- one-line tag clamp on ALL cards here (blog + data): overflow
     collapses into a "+N" chip that reveals the rest on hover ---- */
  function clampChips(ul) {
    ul.classList.remove("is-expanded");
    var old = ul.querySelector(".chip-more");
    if (old) old.remove();
    var items = Array.prototype.slice.call(ul.querySelectorAll("li"));
    if (!items.length) return;
    items.forEach(function (li) { li.classList.remove("chip-overflow"); });
    var top = items[0].offsetTop;
    var overflow = items.filter(function (li) { return li.offsetTop > top; });
    if (!overflow.length) return;
    overflow.forEach(function (li) { li.classList.add("chip-overflow"); });
    var more = document.createElement("li");
    more.className = "chip-more";
    more.textContent = "+" + overflow.length;
    ul.appendChild(more);
    more.addEventListener("mouseenter", function () { ul.classList.add("is-expanded"); });
    ul.addEventListener("mouseleave", function () { ul.classList.remove("is-expanded"); });
  }
  function clampAll() {
    document.querySelectorAll(".res-section .collab-chips").forEach(clampChips);
  }
  clampAll();
  var chipT;
  window.addEventListener("resize", function () {
    clearTimeout(chipT);
    chipT = setTimeout(clampAll, 250);
  });

  /* ---- data tabs (initiative) + type filters, combined ---- */
  var tabs = document.getElementById("dataTabs");
  var typebar = document.getElementById("dataTypebar");
  var dataGrid = document.getElementById("dataGrid");
  var tabDesc = document.getElementById("dataTabDesc");
  if (tabs && dataGrid) {
    var dataCards = Array.prototype.slice.call(dataGrid.querySelectorAll(".res-data-card"));
    var dataState = { tab: "all", type: "all" };
    var dataSec = registerSection(dataGrid, dataCards, function (card) {
      return (dataState.tab === "all" || card.getAttribute("data-tab") === dataState.tab) &&
        (dataState.type === "all" || card.getAttribute("data-type") === dataState.type);
    });

    function applyData() { renderSection(dataSec, true); }

    /* only offer type pills that exist inside the current tab (a "Policy"
       pill under the ODR tab could only ever produce an empty grid); if the
       active type vanishes with the tab switch, fall back to All types */
    function refreshTypePills() {
      if (!typebar) return;
      var present = {};
      dataCards.forEach(function (c) {
        if (dataState.tab === "all" || c.getAttribute("data-tab") === dataState.tab) {
          present[c.getAttribute("data-type")] = true;
        }
      });
      typebar.querySelectorAll(".res-type-pill").forEach(function (b) {
        var t = b.getAttribute("data-type");
        if (t === "all") return;
        var ok = !!present[t];
        b.hidden = !ok;
        if (!ok && dataState.type === t) dataState.type = "all";
        b.classList.toggle("is-active", dataState.type === t);
      });
      typebar.querySelector('[data-type="all"]').classList.toggle("is-active", dataState.type === "all");
    }

    tabs.addEventListener("click", function (e) {
      var btn = e.target.closest(".res-tab");
      if (!btn) return;
      tabs.querySelectorAll(".res-tab").forEach(function (b) { b.classList.remove("is-active"); });
      btn.classList.add("is-active");
      dataState.tab = btn.getAttribute("data-tab");
      if (tabDesc) tabDesc.textContent = btn.getAttribute("data-desc") || "";
      refreshTypePills();
      applyData();
    });

    if (typebar) {
      typebar.addEventListener("click", function (e) {
        var btn = e.target.closest(".res-type-pill");
        if (!btn) return;
        dataState.type = btn.getAttribute("data-type");
        typebar.querySelectorAll(".res-type-pill").forEach(function (b) { b.classList.remove("is-active"); });
        btn.classList.add("is-active");
        applyData();
      });
      refreshTypePills();
    }
  }

  /* ---- learning circles: no filter, but still capped at 2 rows ---- */
  var circleGrid = document.getElementById("circleGrid");
  if (circleGrid) {
    registerSection(
      circleGrid,
      Array.prototype.slice.call(circleGrid.querySelectorAll(".circle-card")),
      function () { return true; }
    );
  }

  /* ---- learning circle video modal ---- */
  var modal = document.getElementById("videoModal");
  if (modal && circleGrid) {
    var frame = document.getElementById("vmFrame");
    var title = document.getElementById("vmTitle");
    var desc = document.getElementById("vmDesc");
    function openVideo(card) {
      var id = card.getAttribute("data-id");
      frame.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0";
      title.textContent = card.getAttribute("data-title") || "";
      desc.textContent = card.getAttribute("data-desc") || "";
      modal.hidden = false;
      document.body.classList.add("modal-open");
    }
    function closeVideo() {
      modal.hidden = true;
      frame.src = "about:blank"; // stops playback
      document.body.classList.remove("modal-open");
    }
    circleGrid.addEventListener("click", function (e) {
      var card = e.target.closest(".circle-card");
      if (card) openVideo(card);
    });
    modal.addEventListener("click", function (e) {
      if (e.target.hasAttribute && e.target.hasAttribute("data-close")) closeVideo();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !modal.hidden) closeVideo();
    });
  }
})();
