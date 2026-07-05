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

  /* ---- blog topic filter ---- */
  var tagbar = document.getElementById("blogTagbar");
  var blogGrid = document.getElementById("blogGrid");
  if (tagbar && blogGrid) {
    tagbar.addEventListener("click", function (e) {
      var btn = e.target.closest(".res-tab");
      if (!btn) return;
      tagbar.querySelectorAll(".res-tab").forEach(function (b) { b.classList.remove("is-active"); });
      btn.classList.add("is-active");
      var tag = btn.getAttribute("data-tag");
      blogGrid.querySelectorAll(".res-card").forEach(function (card) {
        var tags = (card.getAttribute("data-tags") || "").split("|");
        card.hidden = tag !== "all" && tags.indexOf(tag) === -1;
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

  /* ---- data tabs ---- */
  var tabs = document.getElementById("dataTabs");
  var dataGrid = document.getElementById("dataGrid");
  var tabDesc = document.getElementById("dataTabDesc");
  if (tabs && dataGrid) {
    tabs.addEventListener("click", function (e) {
      var btn = e.target.closest(".res-tab");
      if (!btn) return;
      tabs.querySelectorAll(".res-tab").forEach(function (b) { b.classList.remove("is-active"); });
      btn.classList.add("is-active");
      var key = btn.getAttribute("data-tab");
      if (tabDesc) tabDesc.textContent = btn.getAttribute("data-desc") || "";
      dataGrid.querySelectorAll(".res-data-card").forEach(function (card) {
        card.hidden = key !== "all" && card.getAttribute("data-tab") !== key;
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
