/* =========================================================
   PUCAR — collaborate section
   Cards are static HTML (generated at build). This script
   progressively enhances them: clicking a card opens a modal
   and pushes the job's real URL (/collaborate/<slug>/), so
   deeplinks stay crawlable and shareable while browsing feels
   instant. Without JS the cards are plain links to the pages.
   ========================================================= */
(function () {
  "use strict";

  var grid = document.getElementById("collabGrid");
  var modal = document.getElementById("jobModal");
  if (!grid || !modal) return;

  var titleEl = document.getElementById("jobModalTitle");
  var typeEl = document.getElementById("jobModalType");
  var chipsEl = document.getElementById("jobModalChips");
  var bodyEl = document.getElementById("jobModalBody");
  var applyEl = document.getElementById("jobModalApply");
  var permaEl = document.getElementById("jobModalPermalink");

  var jobs = null;      // slug -> job, loaded lazily
  var pushed = false;   // did we pushState for the open modal?

  function loadJobs(cb) {
    if (jobs) return cb();
    fetch("/collaborate/jobs.json")
      .then(function (r) { return r.json(); })
      .then(function (list) {
        jobs = {};
        list.forEach(function (j) { jobs[j.slug] = j; });
        cb();
      })
      .catch(function () { jobs = null; cb(); });
  }

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function openModal(job) {
    typeEl.textContent = job.type || "Role";
    titleEl.textContent = job.title;
    chipsEl.innerHTML = [job.commitment, job.location]
      .concat(job.tags || [])
      .filter(Boolean)
      .map(function (c) { return "<li>" + esc(c) + "</li>"; })
      .join("");
    bodyEl.innerHTML = job.html || "<p>" + esc(job.summary || "") + "</p>";
    applyEl.href = job.apply_url || "mailto:collaborate@pucar.org";
    permaEl.href = job.url;
    modal.hidden = false;
    document.body.classList.add("modal-open");
    modal.querySelector(".job-modal-close").focus();
  }

  function closeModal(viaHistory) {
    if (modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove("modal-open");
    if (pushed && !viaHistory) history.back();
    pushed = false;
  }

  grid.addEventListener("click", function (e) {
    var card = e.target.closest ? e.target.closest("a.collab-card") : null;
    if (!card || e.metaKey || e.ctrlKey || e.shiftKey) return; // let new-tab clicks through
    e.preventDefault();
    var slug = card.getAttribute("data-slug");
    loadJobs(function () {
      var job = jobs && jobs[slug];
      if (!job) { window.location.href = card.href; return; } // fallback: real page
      openModal(job);
      history.pushState({ job: slug }, "", job.url);
      pushed = true;
    });
  });

  modal.addEventListener("click", function (e) {
    if (e.target.hasAttribute && e.target.hasAttribute("data-close")) closeModal(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeModal(false);
  });
  window.addEventListener("popstate", function () {
    closeModal(true);
  });
})();
