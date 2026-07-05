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

  /* ---- blog topic filter ---- */
  var tagbar = document.getElementById("blogTagbar");
  var blogGrid = document.getElementById("blogGrid");
  if (tagbar && blogGrid) {
    var blogCards = Array.prototype.slice.call(blogGrid.querySelectorAll(".res-card"));
    tagbar.addEventListener("click", function (e) {
      var btn = e.target.closest(".res-tab");
      if (!btn) return;
      tagbar.querySelectorAll(".res-tab").forEach(function (b) { b.classList.remove("is-active"); });
      btn.classList.add("is-active");
      var tag = btn.getAttribute("data-tag");
      animateFilter(blogGrid, blogCards, function (card) {
        var tags = (card.getAttribute("data-tags") || "").split("|");
        return tag === "all" || tags.indexOf(tag) !== -1;
      });
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

  /* ---- data tabs ---- */
  var tabs = document.getElementById("dataTabs");
  var dataGrid = document.getElementById("dataGrid");
  var tabDesc = document.getElementById("dataTabDesc");
  if (tabs && dataGrid) {
    var dataCards = Array.prototype.slice.call(dataGrid.querySelectorAll(".res-data-card"));
    tabs.addEventListener("click", function (e) {
      var btn = e.target.closest(".res-tab");
      if (!btn) return;
      tabs.querySelectorAll(".res-tab").forEach(function (b) { b.classList.remove("is-active"); });
      btn.classList.add("is-active");
      var key = btn.getAttribute("data-tab");
      if (tabDesc) tabDesc.textContent = btn.getAttribute("data-desc") || "";
      animateFilter(dataGrid, dataCards, function (card) {
        return key === "all" || card.getAttribute("data-tab") === key;
      });
    });
  }

  /* ---- learning circle video modal ---- */
  var modal = document.getElementById("videoModal");
  var circleGrid = document.getElementById("circleGrid");
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
