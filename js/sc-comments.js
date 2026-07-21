/* PUCAR — /sc-ai-policy/ submission section.
   Scroll-spy: highlight the outline (TOC) link for whichever block is
   currently in view. Progressive enhancement — the TOC is a plain list of
   in-page anchors and works fine without this. */
(function () {
  "use strict";

  var toc = document.getElementById("subToc");
  if (!toc || !("IntersectionObserver" in window)) return;

  var links = Array.prototype.slice.call(toc.querySelectorAll(".sub-toc-link"));
  if (!links.length) return;

  var dot = toc.querySelector(".sub-toc-dot");
  function moveDot(a) {
    if (!dot || !a) return;
    var y = a.offsetTop + (a.offsetHeight / 2) - (dot.offsetHeight / 2);
    dot.style.transform = "translateY(" + y + "px)";
    dot.classList.add("is-on");
  }

  var byId = {};
  var sections = [];
  links.forEach(function (a) {
    var id = (a.getAttribute("href") || "").replace(/^#/, "");
    var sec = id && document.getElementById(id);
    if (sec) { byId[id] = a; sections.push(sec); }
  });
  if (!sections.length) return;

  var current = null;
  function setActive(a) {
    if (a === current) return;
    if (current) current.classList.remove("is-active");
    if (a) { a.classList.add("is-active"); moveDot(a); }
    current = a;
  }

  // keep the dot aligned if the layout reflows (resize / font load)
  window.addEventListener("resize", function () { moveDot(current); });

  // Track the visibility of each section; the topmost one that's on screen wins.
  var visible = {};
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      visible[e.target.id] = e.isIntersecting;
    });
    var top = null, topY = Infinity;
    sections.forEach(function (sec) {
      if (!visible[sec.id]) return;
      var y = sec.getBoundingClientRect().top;
      if (y < topY) { topY = y; top = sec; }
    });
    if (top) setActive(byId[top.id]);
  }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });

  sections.forEach(function (sec) { observer.observe(sec); });
})();
