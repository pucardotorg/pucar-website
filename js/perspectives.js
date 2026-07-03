/* =========================================================
   PUCAR — /sc-ai-policy/ perspectives
   Cards are static HTML (generated at build) reusing the
   collaborate-card classes; this enhances them with the same
   job-modal, filled from perspectives.json. Clicking a card
   opens the SUMMARY modal; the "Read the original" button (and
   cmd/ctrl-click on the card) goes to the source article.
   Without JS, cards are plain links to the originals.
   ========================================================= */
(function () {
  "use strict";

  var grid = document.getElementById("perspGrid");
  var modal = document.getElementById("jobModal");
  if (!grid || !modal) return;

  var titleEl = document.getElementById("jobModalTitle");
  var typeEl = document.getElementById("jobModalType");
  var metaEl = document.getElementById("jobModalMeta");
  var chipsEl = document.getElementById("jobModalChips");
  var bodyEl = document.getElementById("jobModalBody");
  var origEl = document.getElementById("jobModalApply");

  var items = null;

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function load(cb) {
    if (items) return cb();
    fetch("./perspectives.json")
      .then(function (r) { return r.json(); })
      .then(function (list) {
        items = {};
        list.forEach(function (p) { items[p.slug] = p; });
        cb();
      })
      .catch(function () { items = null; cb(); });
  }

  function openModal(p) {
    typeEl.textContent = p.author || "";
    titleEl.textContent = p.title;
    metaEl.innerHTML =
      '<span class="collab-cat">' + esc(p.type || "View") + "</span>" +
      (p.outlet ? '<span class="collab-status">' + esc(p.outlet) + "</span>" : "");
    chipsEl.innerHTML = (p.tags || [])
      .map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("");
    bodyEl.innerHTML = p.html || "";
    if (p.url) {
      origEl.href = p.url;
      origEl.hidden = false;
    } else {
      origEl.hidden = true;
    }
    modal.hidden = false;
    document.body.classList.add("modal-open");
    modal.querySelector(".job-modal-close").focus();
  }

  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove("modal-open");
  }

  grid.addEventListener("click", function (e) {
    var link = e.target.closest ? e.target.closest("a.collab-cover") : null;
    if (!link || e.metaKey || e.ctrlKey || e.shiftKey) return; // modified clicks go to the article
    var slug = link.closest(".collab-card").getAttribute("data-slug");
    e.preventDefault();
    load(function () {
      var p = items && items[slug];
      if (!p) { if (link.href && link.getAttribute("href") !== "#") window.open(link.href, "_blank"); return; }
      openModal(p);
    });
  });

  modal.addEventListener("click", function (e) {
    if (e.target.hasAttribute && e.target.hasAttribute("data-close")) closeModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeModal();
  });
})();
