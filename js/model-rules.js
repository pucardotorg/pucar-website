/* =========================================================
   /model-rules/: search, Part filters and open/close all over
   the rule groups. Without JS the groups are plain <details>
   and the page still reads in full; the toolbar stays hidden.
   A #rule-N or group hash opens the group that holds it.
   ========================================================= */
(function () {
  "use strict";

  var tools = document.getElementById("mrTools");
  var input = document.getElementById("mrSearch");
  var countEl = document.getElementById("mrCount");
  var emptyEl = document.getElementById("mrEmpty");
  var toggleAll = document.getElementById("mrToggleAll");
  if (!tools || !input) return;
  tools.hidden = false;

  var parts = Array.prototype.slice.call(document.querySelectorAll(".mr-part"));
  var groups = Array.prototype.slice.call(document.querySelectorAll(".mr-group"));
  var chips = Array.prototype.slice.call(tools.querySelectorAll(".mr-chip"));
  var activePart = "all";
  var timer = null;

  function clearMarks() {
    document.querySelectorAll("mark.mr-hit").forEach(function (m) {
      var parent = m.parentNode;
      parent.replaceChild(document.createTextNode(m.textContent), m);
      parent.normalize();
    });
  }

  function markIn(root, q) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      var text = node.nodeValue, lower = text.toLowerCase(), at = lower.indexOf(q);
      if (at === -1) return;
      var frag = document.createDocumentFragment(), from = 0;
      while (at !== -1) {
        frag.appendChild(document.createTextNode(text.slice(from, at)));
        var mark = document.createElement("mark");
        mark.className = "mr-hit";
        mark.textContent = text.slice(at, at + q.length);
        frag.appendChild(mark);
        from = at + q.length;
        at = lower.indexOf(q, from);
      }
      frag.appendChild(document.createTextNode(text.slice(from)));
      node.parentNode.replaceChild(frag, node);
    });
  }

  function apply() {
    var q = input.value.trim().toLowerCase();
    clearMarks();
    var shown = 0;
    parts.forEach(function (part) {
      var inPart = activePart === "all" || part.getAttribute("data-part") === activePart;
      var partShown = 0;
      part.querySelectorAll(".mr-group").forEach(function (g) {
        var hit = inPart && (!q || g.textContent.toLowerCase().indexOf(q) !== -1);
        g.hidden = !hit;
        if (hit) {
          partShown++;
          if (q) { g.open = true; markIn(g, q); }
        }
      });
      part.hidden = !partShown;
      shown += partShown;
    });
    countEl.textContent = shown + " of " + groups.length + " sections";
    emptyEl.hidden = shown > 0;
    syncToggle();
  }

  function syncToggle() {
    var visible = groups.filter(function (g) { return !g.hidden; });
    var allOpen = visible.length && visible.every(function (g) { return g.open; });
    toggleAll.textContent = allOpen ? "Close all" : "Open all";
  }

  input.addEventListener("input", function () {
    clearTimeout(timer);
    timer = setTimeout(apply, 140);
  });

  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      activePart = chip.getAttribute("data-part");
      chips.forEach(function (c) {
        var on = c === chip;
        c.classList.toggle("is-on", on);
        c.setAttribute("aria-pressed", on ? "true" : "false");
      });
      apply();
    });
  });

  toggleAll.addEventListener("click", function () {
    var open = toggleAll.textContent === "Open all";
    groups.forEach(function (g) { if (!g.hidden) g.open = open; });
    syncToggle();
  });

  groups.forEach(function (g) { g.addEventListener("toggle", syncToggle); });

  /* deep links: #rule-37 or #part-x open the group that holds them */
  function openHash() {
    var id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    var el = document.getElementById(id);
    if (!el) return;
    var g = el.closest(".mr-group");
    if (!g) return;
    g.hidden = false;
    g.open = true;
    el.scrollIntoView({ block: "start" });
  }
  window.addEventListener("hashchange", openHash);

  apply();
  openHash();
})();
