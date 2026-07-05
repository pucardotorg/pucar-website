/* =========================================================
   PUCAR — mobile navigation (≤640px, all pages)

   Desktop nav pills don't fit a phone (expanded menus run over
   the logo), so below 640px CSS hides the pills entirely and
   this script provides:
   - a collapsed "Main Menu" burger pill in the header
   - a full-screen tinted overlay with a VERTICAL list built by
     walking the real nav DOM, keeping the submenu hierarchy:
     dropdown names become green section headings, the Community
     menu's group labels stay as sub-labels, and pages with a
     sub-nav get an "On this page" section at the top.
   The overlay exists on desktop too but its trigger is hidden,
   so nothing changes above the breakpoint.
   ========================================================= */
(function () {
  "use strict";
  var header = document.querySelector(".site-header");
  if (!header) return;
  var mainNav = header.querySelector(".site-nav.main-nav") || header.querySelector(".site-nav");
  if (!mainNav) return;
  var subNav = header.querySelector(".site-nav.sub-nav");

  var BURGER = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2 4h12M2 8h12M2 12h12"/></svg>';

  /* ---- trigger pill ---- */
  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "mobile-nav-btn";
  btn.setAttribute("aria-haspopup", "true");
  btn.setAttribute("aria-expanded", "false");
  btn.innerHTML = BURGER + "<span>Main Menu</span>";
  var mount = header.querySelector(".header-right") || header.querySelector(".nav-cluster") || header;
  mount.appendChild(btn);

  /* ---- overlay ---- */
  var ov = document.createElement("div");
  ov.className = "mobile-nav-overlay";
  ov.hidden = true;

  var close = document.createElement("button");
  close.type = "button";
  close.className = "mnav-close";
  close.setAttribute("aria-label", "Close menu");
  close.textContent = "×";
  ov.appendChild(close);

  var list = document.createElement("nav");
  list.className = "mnav-list";
  list.setAttribute("aria-label", "Site menu");
  ov.appendChild(list);

  function addHeading(text, cls) {
    var h = document.createElement("p");
    h.className = cls || "mnav-heading";
    h.textContent = text;
    list.appendChild(h);
  }
  function addLink(href, title, sub) {
    var a = document.createElement("a");
    a.className = "mnav-link";
    a.href = href;
    a.appendChild(document.createTextNode(title));
    if (sub) {
      var s = document.createElement("span");
      s.className = "mnav-sub";
      s.textContent = sub;
      a.appendChild(s);
    }
    list.appendChild(a);
  }
  function textOf(el) { // first text, ignoring svg carets
    return (el.textContent || "").trim();
  }

  // pages with a sub-nav: its links come first, under "On this page"
  if (subNav) {
    addHeading("On this page");
    Array.prototype.forEach.call(subNav.children, function (el) {
      if (el.tagName === "A" && !el.classList.contains("subnav-top")) {
        addLink(el.getAttribute("href"), textOf(el));
      }
    });
    addHeading("Menu");
  }

  Array.prototype.forEach.call(mainNav.children, function (el) {
    if (el.classList && el.classList.contains("nav-home")) {
      if (location.pathname !== "/") addLink("/", "Home"); // pointless on the homepage
      return;
    }
    if (el.tagName === "A") {
      addLink(el.getAttribute("href"), textOf(el));
      return;
    }
    if (el.classList && el.classList.contains("nav-drop")) {
      var trig = el.querySelector(".nav-drop-trigger");
      addHeading(trig ? textOf(trig) : "");
      var menu = el.querySelector(".nav-menu");
      if (!menu) return;
      Array.prototype.forEach.call(menu.children, function (m) {
        if (m.classList.contains("nav-menu-label")) {
          addHeading(textOf(m), "mnav-group-label");
        } else if (m.classList.contains("nav-menu-item")) {
          var t = m.querySelector(".nav-menu-title");
          var s = m.querySelector(".nav-menu-sub");
          addLink(m.getAttribute("href"), t ? textOf(t) : textOf(m), s ? textOf(s) : "");
        }
      });
    }
  });

  // homepage carries the Get in touch CTA (a contact-modal trigger)
  var cta = header.querySelector(".header-cta");
  if (cta) {
    var go = document.createElement("button");
    go.type = "button";
    go.className = "btn btn-primary mnav-cta";
    go.textContent = textOf(cta) || "Get in touch";
    go.addEventListener("click", function () {
      closeOv();
      cta.click();
    });
    list.appendChild(go);
  }

  document.body.appendChild(ov);

  function openOv() {
    ov.hidden = false;
    document.body.classList.add("modal-open");
    btn.setAttribute("aria-expanded", "true");
  }
  function closeOv() {
    ov.hidden = true;
    document.body.classList.remove("modal-open");
    btn.setAttribute("aria-expanded", "false");
  }
  btn.addEventListener("click", openOv);
  close.addEventListener("click", closeOv);
  ov.addEventListener("click", function (e) {
    if (e.target.closest("a")) closeOv(); // same-page anchors need this too
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !ov.hidden) closeOv();
  });
})();
