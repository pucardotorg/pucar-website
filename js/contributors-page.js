/* Contributors index page: search + organisation filter.
   Same custom-dropdown pattern as js/collaborate.js (OS selects look off-theme). */
(function () {
  "use strict";

  var grid = document.getElementById("contribGrid");
  if (!grid) return;
  var cards = Array.prototype.slice.call(grid.querySelectorAll(".contrib-card"));
  var search = document.getElementById("contribSearch");
  var orgSel = document.getElementById("contribOrg");
  var count = document.getElementById("contribCount");
  var clear = document.getElementById("contribClear");
  var filtersBar = document.getElementById("contribFilters");
  if (filtersBar) filtersBar.hidden = false;

  /* ---------- custom dropdown (mirrors collaborate.js) ---------- */
  function closeAllDropdowns() {
    document.querySelectorAll(".dd-menu").forEach(function (m) { m.hidden = true; });
    document.querySelectorAll(".dd-btn").forEach(function (b) { b.setAttribute("aria-expanded", "false"); });
  }
  document.addEventListener("click", function (e) {
    if (!e.target.closest(".dd")) closeAllDropdowns();
  });

  function enhanceSelect(sel) {
    var dd = document.createElement("div");
    dd.className = "dd";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dd-btn";
    btn.setAttribute("aria-haspopup", "listbox");
    btn.setAttribute("aria-expanded", "false");
    if (sel.getAttribute("aria-label")) btn.setAttribute("aria-label", sel.getAttribute("aria-label"));
    var menu = document.createElement("ul");
    menu.className = "dd-menu";
    menu.setAttribute("role", "listbox");
    menu.hidden = true;

    function render() {
      var cur = sel.options[sel.selectedIndex];
      btn.textContent = cur ? cur.text : "";
      btn.classList.toggle("is-set", !!sel.value);
      menu.innerHTML = "";
      Array.prototype.forEach.call(sel.options, function (o, i) {
        var li = document.createElement("li");
        li.setAttribute("role", "option");
        li.tabIndex = -1;
        li.textContent = o.text;
        li.setAttribute("data-i", i);
        if (i === sel.selectedIndex) li.setAttribute("aria-selected", "true");
        menu.appendChild(li);
      });
    }
    sel.__ddRender = render;

    function open() { closeAllDropdowns(); menu.hidden = false; btn.setAttribute("aria-expanded", "true"); }
    function close() { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); }
    function pick(li) {
      sel.selectedIndex = parseInt(li.getAttribute("data-i"), 10);
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      render(); close(); btn.focus();
    }

    btn.addEventListener("click", function () { menu.hidden ? open() : close(); });
    btn.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (menu.hidden) open();
        var items = menu.querySelectorAll("li");
        var idx = sel.selectedIndex + (e.key === "ArrowDown" ? 1 : -1);
        if (idx >= 0 && idx < items.length) items[idx].focus();
      }
      if (e.key === "Escape") close();
    });
    menu.addEventListener("click", function (e) {
      var li = e.target.closest("li"); if (li) pick(li);
    });
    menu.addEventListener("keydown", function (e) {
      var li = e.target.closest("li"); if (!li) return;
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(li); }
      if (e.key === "ArrowDown" && li.nextElementSibling) { e.preventDefault(); li.nextElementSibling.focus(); }
      if (e.key === "ArrowUp" && li.previousElementSibling) { e.preventDefault(); li.previousElementSibling.focus(); }
      if (e.key === "Escape") { close(); btn.focus(); }
    });

    sel.hidden = true;
    sel.parentNode.insertBefore(dd, sel);
    dd.appendChild(btn);
    dd.appendChild(menu);
    dd.appendChild(sel);
    render();
  }
  if (orgSel) enhanceSelect(orgSel);

  /* ---------- filtering ---------- */
  function norm(s) { return (s || "").toLowerCase(); }

  function apply() {
    var q = norm(search && search.value).trim();
    var org = orgSel ? orgSel.value : "";
    var shown = 0;
    cards.forEach(function (card) {
      var hay = norm(card.getAttribute("data-name") + " " +
        card.getAttribute("data-role") + " " + card.getAttribute("data-org"));
      var ok = (!q || hay.indexOf(q) !== -1) &&
        (!org || card.getAttribute("data-org") === org);
      card.hidden = !ok;
      if (ok) shown++;
    });
    if (count) {
      var active = q || org;
      count.hidden = !active;
      count.textContent = shown === 0 ? "No one matches those filters."
        : "Showing " + shown + " of " + cards.length + " contributors";
    }
    if (clear) clear.hidden = !(q || org);
  }

  if (search) search.addEventListener("input", apply);
  if (orgSel) orgSel.addEventListener("change", apply);
  if (clear) clear.addEventListener("click", function () {
    if (search) search.value = "";
    if (orgSel) { orgSel.value = ""; if (orgSel.__ddRender) orgSel.__ddRender(); }
    apply();
  });
  apply();
})();

/* ---- profile modal: cards open in the shared job-modal chrome (same as
   the contact modal) instead of navigating. Deep links stay intact: the
   per-person pages still exist and are crawlable, plain clicks pushState to
   the profile URL while the modal is open, and closing goes back. Modified
   clicks (cmd/ctrl/middle) still open the real page. ---- */
(function () {
  "use strict";
  var modal = document.getElementById("contribModal");
  var grid = document.getElementById("contribGrid");
  if (!modal || !grid || !window.fetch) return;
  var photoEl = document.getElementById("cmPhoto");
  var nameEl = document.getElementById("cmName");
  var roleEl = document.getElementById("cmRole");
  var bodyEl = document.getElementById("cmBody");
  var linksEl = document.getElementById("cmLinks");
  var profiles = null, loading = false, pushed = false;

  function load(then) {
    if (profiles) { then(); return; }
    if (loading) return;
    loading = true;
    fetch("/contributors/profiles.json")
      .then(function (r) { return r.json(); })
      .then(function (p) { profiles = p; loading = false; then(); })
      .catch(function () { loading = false; });
  }

  function openModal(slug, push) {
    var p = null;
    for (var i = 0; i < profiles.length; i++) if (profiles[i].slug === slug) { p = profiles[i]; break; }
    if (!p) return;
    if (p.photo) { photoEl.src = p.photo; photoEl.hidden = false; } else { photoEl.hidden = true; }
    photoEl.alt = p.name;
    nameEl.textContent = p.name;
    // skip the org when the role already names it ("CTO, Zerodha · Zerodha")
    var dupe = p.role && p.organisation &&
      p.role.toLowerCase().indexOf(p.organisation.toLowerCase()) !== -1;
    roleEl.textContent = [p.role, dupe ? "" : p.organisation].filter(Boolean).join(" · ");
    bodyEl.innerHTML = p.html || "";
    linksEl.textContent = "";
    (p.links || []).forEach(function (l) {
      if (!l || !l.url) return;
      var a = document.createElement("a");
      a.className = "btn btn-outline";
      a.href = l.url;
      a.rel = "noopener";
      a.target = "_blank";
      a.textContent = l.label || "Link";
      linksEl.appendChild(a);
    });
    modal.hidden = false;
    document.body.classList.add("modal-open");
    if (push) {
      history.pushState({ contribModal: slug }, "", p.url);
      pushed = true;
    }
  }

  function closeModal(viaHistory) {
    modal.hidden = true;
    document.body.classList.remove("modal-open");
    if (pushed && !viaHistory) history.back();
    pushed = false;
  }

  grid.addEventListener("click", function (e) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    var card = e.target.closest(".contrib-card");
    if (!card) return;
    e.preventDefault();
    var slug = card.getAttribute("data-slug") ||
      (card.getAttribute("href") || "").replace(/\/$/, "").split("/").pop();
    load(function () { openModal(slug, true); });
  });
  modal.addEventListener("click", function (e) {
    if (e.target.hasAttribute && e.target.hasAttribute("data-close")) closeModal(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.hidden) closeModal(false);
  });
  window.addEventListener("popstate", function () {
    if (!modal.hidden) closeModal(true);
  });
})();
