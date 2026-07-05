/* =========================================================
   PUCAR — /team/ page
   Portrait cards (grayscale -> colour on hover, CSS-only);
   this file only wires the bio modal: clicking a card opens
   the shared job-modal chrome with the person's photo, role,
   3rd-person bio, and links. Data is inlined at build time in
   #teamData, so there's nothing to fetch. The LinkedIn chip
   inside each card is a real <a> and must NOT open the modal.
   ========================================================= */
(function () {
  "use strict";
  var grid = document.getElementById("teamGrid");
  var modal = document.getElementById("teamModal");
  var dataEl = document.getElementById("teamData");
  if (!grid || !modal || !dataEl) return;

  var team;
  try { team = JSON.parse(dataEl.textContent); } catch (e) { return; }

  var photoEl = document.getElementById("tmPhoto");
  var nameEl = document.getElementById("tmName");
  var roleEl = document.getElementById("tmRole");
  var bodyEl = document.getElementById("tmBody");
  var linksEl = document.getElementById("tmLinks");

  function openModal(slug) {
    var p = null;
    for (var i = 0; i < team.length; i++) if (team[i].slug === slug) { p = team[i]; break; }
    if (!p) return;
    photoEl.src = p.photo;
    photoEl.alt = p.name;
    nameEl.textContent = p.name;
    roleEl.textContent = p.role + " · PUCAR";
    bodyEl.innerHTML = "";
    var para = document.createElement("p");
    para.textContent = p.bio || "";
    bodyEl.appendChild(para);
    linksEl.textContent = "";
    [{ label: "LinkedIn", url: p.linkedin }, { label: "Website", url: p.site }].forEach(function (l) {
      if (!l.url) return;
      var a = document.createElement("a");
      a.className = "btn btn-outline";
      a.href = l.url;
      a.rel = "noopener";
      a.target = "_blank";
      a.textContent = l.label;
      linksEl.appendChild(a);
    });
    modal.hidden = false;
    document.body.classList.add("modal-open");
  }
  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove("modal-open");
  }

  grid.addEventListener("click", function (e) {
    if (e.target.closest("a")) return; // the LinkedIn chip navigates, no modal
    var card = e.target.closest(".team-card");
    if (card) openModal(card.getAttribute("data-slug"));
  });
  grid.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var card = e.target.closest(".team-card");
    if (card) { e.preventDefault(); openModal(card.getAttribute("data-slug")); }
  });
  modal.addEventListener("click", function (e) {
    if (e.target.hasAttribute && e.target.hasAttribute("data-close")) closeModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.hidden) closeModal();
  });
})();

/* ---- contributors strip under the team grid: same head-stack fill as the
   homepage's (js/script.js is homepage-only, so the logic lives here too) ---- */
(function () {
  "use strict";
  var stack = document.getElementById("stripStack");
  if (!stack || !window.fetch) return;
  fetch("/contributors/photos.json")
    .then(function (r) { return r.json(); })
    .then(function (photos) {
      if (!photos || !photos.length) return;
      var pool = photos.slice();
      var n = Math.min(7, pool.length);
      for (var i = 0; i < n; i++) {
        var pick = pool.splice((Math.random() * pool.length) | 0, 1)[0];
        var head = document.createElement("span");
        head.className = "strip-head";
        var img = document.createElement("img");
        img.src = pick.src || pick;
        img.alt = "";
        img.loading = "lazy";
        var wave = document.createElement("span");
        wave.className = "strip-wave";
        wave.textContent = "👋";
        wave.style.animationDelay = (i * 0.12) + "s";
        head.appendChild(img);
        head.appendChild(wave);
        stack.appendChild(head);
      }
    })
    .catch(function () { /* strip text still works without heads */ });
})();
