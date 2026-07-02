(function () {
  "use strict";

  var story = document.getElementById("story");
  var pin = document.getElementById("pin");
  var beatEls = Array.prototype.slice.call(document.querySelectorAll(".beat"));
  var progressFill = document.getElementById("progressFill");
  var beatIndexEl = document.getElementById("beatIndex");
  var beatTotalEl = document.getElementById("beatTotal");
  var numBeats = beatEls.length;

  if (beatTotalEl) beatTotalEl.textContent = String(numBeats);

  var currentBeat = -1;
  var ticking = false;
  var walkTimeout = null;
  var idleTimeout = null;
  var IDLE_DELAY = 10000; // ms without scrolling before she looks around

  function resetIdle() {
    pin.classList.remove("is-idle");
    clearTimeout(idleTimeout);
    idleTimeout = setTimeout(function () {
      pin.classList.add("is-idle");
    }, IDLE_DELAY);
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function easeOutQuad(t) {
    return 1 - (1 - t) * (1 - t);
  }

  function animateCount(el) {
    if (el.dataset.done === "1") return;
    el.dataset.done = "1";
    var target = parseFloat(el.getAttribute("data-target")) || 0;
    var suffix = el.getAttribute("data-suffix") || "";
    var decimals = (String(target).split(".")[1] || "").length;
    var duration = 1100;
    var start = null;

    function step(ts) {
      if (start === null) start = ts;
      var elapsed = ts - start;
      var t = clamp(elapsed / duration, 0, 1);
      var eased = easeOutQuad(t);
      var value = target * eased;
      el.textContent = value.toFixed(decimals) + suffix;
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = target.toFixed(decimals) + suffix;
      }
    }
    requestAnimationFrame(step);
  }

  function setActiveBeat(index) {
    if (index === currentBeat) return;
    currentBeat = index;

    pin.setAttribute("data-beat", String(index));
    if (beatIndexEl) beatIndexEl.textContent = String(index + 1);

    beatEls.forEach(function (el) {
      var beatNum = parseInt(el.getAttribute("data-beat"), 10);
      if (beatNum === index) {
        el.classList.add("is-active");
        var counters = el.querySelectorAll(".count-up");
        counters.forEach(animateCount);
      } else {
        el.classList.remove("is-active");
      }
    });
  }

  function setWalking(isWalking) {
    if (isWalking) {
      pin.classList.add("is-walking");
    } else {
      pin.classList.remove("is-walking");
    }
  }

  function onScrollFrame() {
    ticking = false;

    var rect = story.getBoundingClientRect();
    var viewportH = window.innerHeight;
    var totalScrollable = rect.height - viewportH;
    var progress = totalScrollable > 0 ? clamp(-rect.top / totalScrollable, 0, 1) : 0;

    // only run the story mechanics while the story section is actually
    // on screen (rect.top <= 0 and rect.bottom >= 0 roughly, i.e. pinned)
    var inStory = rect.top <= 1 && rect.bottom >= viewportH - 1;

    if (progress <= 0) {
      setActiveBeat(0);
    } else if (progress >= 1) {
      setActiveBeat(numBeats - 1);
    } else if (inStory || rect.top < 0) {
      var beatFloat = progress * (numBeats - 1);
      var nearest = clamp(Math.round(beatFloat), 0, numBeats - 1);
      setActiveBeat(nearest);
    }

    if (progressFill) progressFill.style.width = (progress * 100).toFixed(1) + "%";

    setWalking(true);
    clearTimeout(walkTimeout);
    walkTimeout = setTimeout(function () {
      setWalking(false);
    }, 180);

    resetIdle();
  }

  function requestTick() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(onScrollFrame);
    }
  }

  window.addEventListener("scroll", requestTick, { passive: true });
  window.addEventListener("resize", requestTick);

  // initial state
  setActiveBeat(0);
  onScrollFrame();
})();
