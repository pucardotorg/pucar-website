/* /about/ "Our journey" timeline: cards fade up as they enter, and the
   spine's green fill grows with scroll to the last node passed. */
(function () {
  var track = document.querySelector(".aj-track");
  if (!track) return;
  var fill = track.querySelector(".aj-spine-fill");
  var rows = track.querySelectorAll(".aj-item, .aj-act");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduce || !("IntersectionObserver" in window)) {
    rows.forEach(function (r) { r.classList.add("is-in"); });
  } else {
    track.classList.add("aj-animate");
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -12% 0px" });
    rows.forEach(function (r) { io.observe(r); });
  }

  var ticking = false;
  function update() {
    ticking = false;
    var box = track.getBoundingClientRect();
    var line = window.innerHeight * 0.6; /* the "reading line" */
    var h = Math.max(0, Math.min(box.height, line - box.top));
    fill.style.height = h + "px";
    track.querySelectorAll(".aj-item").forEach(function (it) {
      var n = it.querySelector(".aj-node").getBoundingClientRect();
      it.classList.toggle("is-past", n.top + n.height / 2 <= line);
    });
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  update();
})();
