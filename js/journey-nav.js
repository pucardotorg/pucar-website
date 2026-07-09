/* Beat jumper for the litigant-journey scrollytelling page.
   Adds two small chevron buttons on the right edge that step through the
   story one beat at a time. The story scrubs as beatFloat = -story.top / vh
   (each beat is ~one viewport of scroll, since .story is numBeats*100vh
   tall), so jumping to beat N means scrolling to storyTop + N*vh.

   Self-contained and self-guarding: does nothing on pages without the story
   (it's only loaded on /litigant-journey/). Buttons are created in JS so no
   other page ever shows them. Purely an enhancement over normal scrolling. */
(function () {
  "use strict";

  var story = document.getElementById("story");
  var pin = document.getElementById("pin");
  var beats = document.querySelectorAll(".beat");
  if (!story || !pin || !beats.length) return;

  var numBeats = beats.length;
  var reduce = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function chevron(dir) {
    var d = dir === "up" ? "M4 10l4-4 4 4" : "M4 6l4 4 4-4";
    return '<svg viewBox="0 0 16 16" width="21" height="21" aria-hidden="true" ' +
      'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
      'stroke-linejoin="round"><path d="' + d + '"/></svg>';
  }

  var nav = document.createElement("div");
  nav.className = "journey-nav";

  var up = document.createElement("button");
  up.type = "button";
  up.className = "journey-nav-btn journey-nav-up";
  up.setAttribute("aria-label", "Previous section");
  up.innerHTML = chevron("up");

  var down = document.createElement("button");
  down.type = "button";
  down.className = "journey-nav-btn journey-nav-down";
  down.setAttribute("aria-label", "Next section");
  down.innerHTML = chevron("down");

  nav.appendChild(up);
  nav.appendChild(down);
  document.body.appendChild(nav);

  function beatFloat() {
    return clamp(-story.getBoundingClientRect().top / window.innerHeight, 0, numBeats - 1);
  }
  function storyDocTop() {
    return story.getBoundingClientRect().top + window.pageYOffset;
  }
  function goToBeat(beat) {
    beat = clamp(beat, 0, numBeats - 1);
    window.scrollTo({
      top: Math.round(storyDocTop() + beat * window.innerHeight),
      behavior: reduce ? "auto" : "smooth"
    });
  }

  // step to the neighbouring beat; floor/ceil so a mid-beat position snaps to
  // the current beat on the way "back" and advances cleanly on the way "on"
  up.addEventListener("click", function () { goToBeat(Math.ceil(beatFloat() - 1e-3) - 1); });
  down.addEventListener("click", function () { goToBeat(Math.floor(beatFloat() + 1e-3) + 1); });

  // dim the arrow that has nowhere left to go
  var raf = null;
  function refresh() {
    raf = null;
    var bf = beatFloat();
    up.disabled = bf <= 0.02;
    down.disabled = bf >= numBeats - 1 - 0.02;
  }
  function queueRefresh() { if (!raf) raf = requestAnimationFrame(refresh); }
  window.addEventListener("scroll", queueRefresh, { passive: true });
  window.addEventListener("resize", queueRefresh);
  refresh();

  // only surface the controls while the story actually fills the viewport
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      nav.classList.toggle("is-visible", entries[0].isIntersecting);
    }, { rootMargin: "-40% 0px -40% 0px", threshold: 0 }).observe(story);
  } else {
    nav.classList.add("is-visible");
  }
})();
