/* =========================================================
   PUCAR — collaborate board
   Cards are static HTML (generated at build) carrying data-*
   attributes. This script progressively enhances them:
   - filters (stream / category / difficulty / deadline / tags)
   - "closes in N days" freshness on each card
   - detail modal with pushState to the real crawlable URL
   Without JS: cards are plain links, filters stay hidden.
   ========================================================= */
(function () {
  "use strict";

  var grid = document.getElementById("collabGrid");
  var modal = document.getElementById("jobModal");
  if (!grid || !modal) return;

  var cards = Array.prototype.slice.call(grid.querySelectorAll(".collab-card"));

  /* ---------------- helpers ---------------- */

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }
  function daysUntil(iso) {
    if (!iso) return null;
    var ms = new Date(iso + "T23:59:59") - new Date();
    return Math.ceil(ms / 86400000);
  }

  /* ---------------- freshness: closes-in + expiry hiding ---------------- */

  cards.forEach(function (card) {
    var d = daysUntil(card.getAttribute("data-expiry"));
    if (d !== null && d < 0) { card.setAttribute("data-expired", "1"); } // deploy is stale
    var el = card.querySelector(".collab-closes");
    if (el && d !== null && d >= 0) {
      el.textContent = d === 0 ? "Closes today" : "Closes in " + d + (d === 1 ? " day" : " days");
      if (d <= 5) el.classList.add("is-urgent");
    }
  });

  /* ---------------- filters ---------------- */

  var bar = document.getElementById("collabFilters");
  var tagbar = document.getElementById("collabTagbar");
  var clearBtn = document.getElementById("collabClear");
  var countEl = document.getElementById("collabCount");
  var state = { stream: "", category: "", difficulty: "", deadline: "", tags: [] };

  /* custom dropdowns: replace native <select> UI (OS-styled) with a styled
     button + listbox that matches the site. The hidden select stays the
     source of truth so the change handler below keeps working. */
  function closeAllDropdowns() {
    document.querySelectorAll(".dd-menu").forEach(function (m) { m.hidden = true; });
    document.querySelectorAll(".dd-btn").forEach(function (b) { b.setAttribute("aria-expanded", "false"); });
  }
  document.addEventListener("click", function (e) {
    if (!(e.target.closest && e.target.closest(".dd"))) closeAllDropdowns();
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

    function open() {
      closeAllDropdowns();
      menu.hidden = false;
      btn.setAttribute("aria-expanded", "true");
    }
    function close() {
      menu.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    }
    function pick(li) {
      sel.selectedIndex = parseInt(li.getAttribute("data-i"), 10);
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      render();
      close();
      btn.focus();
    }

    btn.addEventListener("click", function () { menu.hidden ? open() : close(); });
    btn.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        open();
        var first = menu.querySelector('[aria-selected="true"]') || menu.firstChild;
        if (first) first.focus();
      }
    });
    menu.addEventListener("click", function (e) {
      var li = e.target.closest ? e.target.closest("li[role=option]") : null;
      if (li) pick(li);
    });
    menu.addEventListener("keydown", function (e) {
      var li = e.target;
      if (e.key === "Escape") { close(); btn.focus(); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(li); }
      else if (e.key === "ArrowDown" && li.nextSibling) { e.preventDefault(); li.nextSibling.focus(); }
      else if (e.key === "ArrowUp" && li.previousSibling) { e.preventDefault(); li.previousSibling.focus(); }
    });

    dd.appendChild(btn);
    dd.appendChild(menu);
    sel.style.display = "none";
    sel.parentNode.insertBefore(dd, sel.nextSibling);
    render();
  }

  if (bar && cards.length) {
    // populate category options + tag chips from the cards present
    var cats = {}, tags = {};
    cards.forEach(function (c) {
      var cat = c.getAttribute("data-category");
      if (cat) cats[cat] = 1;
      (c.getAttribute("data-tags") || "").split("|").forEach(function (t) { if (t) tags[t] = 1; });
    });
    var catSel = bar.querySelector('[data-filter="category"]');
    Object.keys(cats).sort().forEach(function (c) {
      var o = document.createElement("option");
      o.textContent = c;
      catSel.appendChild(o);
    });
    Object.keys(tags).sort().forEach(function (t) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "collab-tag";
      b.textContent = t;
      b.setAttribute("data-tag", t);
      b.setAttribute("aria-pressed", "false");
      tagbar.appendChild(b);
    });
    bar.querySelectorAll("select").forEach(enhanceSelect);
    bar.hidden = false;

    bar.addEventListener("change", function (e) {
      var f = e.target.getAttribute("data-filter");
      if (!f) return;
      state[f] = e.target.value;
      apply();
    });
    tagbar.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest(".collab-tag") : null;
      if (!b) return;
      var t = b.getAttribute("data-tag");
      var i = state.tags.indexOf(t);
      if (i === -1) state.tags.push(t); else state.tags.splice(i, 1);
      b.setAttribute("aria-pressed", i === -1 ? "true" : "false");
      b.classList.toggle("is-on", i === -1);
      apply();
    });
    clearBtn.addEventListener("click", function () {
      state = { stream: "", category: "", difficulty: "", deadline: "", tags: [] };
      bar.querySelectorAll("select").forEach(function (s) {
        s.value = "";
        if (s.__ddRender) s.__ddRender();
      });
      tagbar.querySelectorAll(".collab-tag").forEach(function (b) {
        b.classList.remove("is-on");
        b.setAttribute("aria-pressed", "false");
      });
      apply();
    });
  }

  function matches(card) {
    if (card.getAttribute("data-expired")) return false;
    if (state.stream && card.getAttribute("data-stream") !== state.stream) return false;
    if (state.category && card.getAttribute("data-category") !== state.category) return false;
    if (state.difficulty && card.getAttribute("data-difficulty") !== state.difficulty) return false;
    if (state.deadline) {
      var d = daysUntil(card.getAttribute("data-deadline"));
      if (d === null || d < 0 || d > parseInt(state.deadline, 10)) return false;
    }
    if (state.tags.length) {
      var have = (card.getAttribute("data-tags") || "").split("|");
      for (var i = 0; i < state.tags.length; i++) {
        if (have.indexOf(state.tags[i]) === -1) return false;
      }
    }
    return true;
  }

  function apply() {
    var shown = 0;
    cards.forEach(function (c) {
      var ok = matches(c);
      c.hidden = !ok;
      if (ok) shown++;
    });
    var active = state.stream || state.category || state.difficulty || state.deadline || state.tags.length;
    clearBtn.hidden = !active;
    countEl.hidden = !active;
    countEl.textContent = active
      ? (shown === 0 ? "Nothing matches those filters — try widening them."
        : shown + (shown === 1 ? " piece" : " pieces") + " of work match")
      : "";
  }
  apply();

  /* ---------------- modal ---------------- */

  var titleEl = document.getElementById("jobModalTitle");
  var typeEl = document.getElementById("jobModalType");
  var metaEl = document.getElementById("jobModalMeta");
  var datesEl = document.getElementById("jobModalDates");
  var chipsEl = document.getElementById("jobModalChips");
  var posterEl = document.getElementById("jobModalPoster");
  var bodyEl = document.getElementById("jobModalBody");
  var applyBtn = document.getElementById("jobModalApply");
  var permaEl = document.getElementById("jobModalPermalink");

  var jobs = null;
  var pushed = false;

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

  function fmt(iso) {
    if (!iso) return "";
    var d = new Date(String(iso).slice(0, 10) + "T00:00:00");
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }
  function diffClass(d) {
    var w = String(d || "moderate").split(" ")[0].toLowerCase();
    return w === "low" ? "diff-low" : w === "high" ? "diff-high" : "diff-moderate";
  }

  function openModal(job) {
    typeEl.textContent = job.streamLabel || job.stream || "Work";
    titleEl.textContent = job.title;
    metaEl.innerHTML =
      '<span class="collab-cat">' + esc(job.category || "Work") + "</span>" +
      '<span class="collab-diff ' + diffClass(job.difficulty) + '">' + esc(job.difficulty || "Moderate") + "</span>";
    var closes = daysUntil(job.expiry);
    datesEl.innerHTML =
      (job.deadline ? "<span><strong>Deadline</strong> " + esc(fmt(job.deadline)) + "</span>" : "") +
      (closes !== null && closes >= 0
        ? '<span class="collab-closes' + (closes <= 5 ? " is-urgent" : "") + '"><strong>Listing closes</strong> ' +
          (closes === 0 ? "today" : "in " + closes + (closes === 1 ? " day" : " days")) + "</span>"
        : "");
    chipsEl.innerHTML = [job.commitment, job.location].concat(job.tags || []).filter(Boolean)
      .map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("");
    posterEl.innerHTML = job.poster
      ? '<a class="collab-poster on-light" href="' + esc(job.poster.url) + '">' +
        (job.poster.photo
          ? '<img class="avatar" src="' + esc(job.poster.photo) + '" alt="" />'
          : '<span class="avatar" aria-hidden="true">' + esc(job.poster.name.split(/\s+/).map(function (w) { return w[0]; }).join("").slice(0, 2).toUpperCase()) + "</span>") +
        '<span class="poster-meta"><span class="poster-label">Posted by</span><span class="poster-name">' + esc(job.poster.name) + "</span></span></a>"
      : "";
    bodyEl.innerHTML = job.html || "<p>" + esc(job.summary || "") + "</p>";
    applyBtn.href = job.apply_url || "mailto:collaborate@pucar.org";
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
    var link = e.target.closest ? e.target.closest("a") : null;
    if (!link || e.metaKey || e.ctrlKey || e.shiftKey) return;
    if (link.classList.contains("collab-poster")) return; // navigate to contributor page
    if (!link.classList.contains("collab-cover")) return;
    e.preventDefault();
    var slug = link.closest(".collab-card").getAttribute("data-slug");
    loadJobs(function () {
      var job = jobs && jobs[slug];
      if (!job) { window.location.href = link.href; return; }
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
  window.addEventListener("popstate", function () { closeModal(true); });
})();
