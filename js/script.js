(function () {
  "use strict";

  var story = document.getElementById("story");
  var pin = document.getElementById("pin");
  var beatEls = Array.prototype.slice.call(document.querySelectorAll(".beat"));
  var progressFill = document.getElementById("progressFill");
  var beatIndexEl = document.getElementById("beatIndex");
  var beatTotalEl = document.getElementById("beatTotal");
  var litigantStage = document.getElementById("litigantStage");
  var numBeats = beatEls.length;

  if (beatTotalEl) beatTotalEl.textContent = String(numBeats);

  var currentBeat = -1;
  var ticking = false;
  var walkTimeout = null;
  var idleTimeout = null;
  var IDLE_DELAY = 10000; // ms without scrolling before she looks around

  // ---- idle speech bubbles ------------------------------------------------
  // Flavour text shown only while she's "idle" (looking around -- i.e. the
  // page has just loaded, or scrolling has stopped for IDLE_DELAY ms).
  // Tied 1:1 to the same .is-idle state resetIdle() manages below: the
  // instant a real scroll event fires, bubbles stop immediately (stopBubbles,
  // called from resetIdle); they only resume after another IDLE_DELAY ms of
  // stillness (startBubbles, called when the idle timeout fires). On first
  // page load she's idle from the very first frame (see "initial state" at
  // the bottom) rather than waiting out the usual 10s, so bubbles begin
  // right away too.
  var SPEECH_LINES = [
    "Oh my god, I'm late to court!",
    "I hope the judge doesn't push the hearing again...",
    "I need to be back home to give mom her medicines by 4pm."
  ];
  var speechEl = document.getElementById("litigantSpeech");
  var speechShowTimer = null;
  var speechHideTimer = null;
  var SPEECH_VISIBLE_MS = 3400;

  // "Dreading" head-shake: fires only sometimes, only alongside a bubble --
  // see .pin.is-dreading / @keyframes headShake in style.css. Kept low so
  // it reads as an occasional flourish, not a tic.
  var DREAD_CHANCE = 0.25; // ~1 in 4 bubbles gets a head-shake
  var DREAD_MS = 950;      // matches the headShake keyframe duration
  var dreadTimer = null;

  function randomDelay(minMs, maxMs) {
    return minMs + Math.random() * (maxMs - minMs);
  }

  function maybeShakeHead() {
    if (Math.random() > DREAD_CHANCE) return;
    pin.classList.add("is-dreading");
    clearTimeout(dreadTimer);
    dreadTimer = setTimeout(function () {
      pin.classList.remove("is-dreading");
    }, DREAD_MS);
  }

  function showSpeechBubble() {
    if (!speechEl) return;
    var line = SPEECH_LINES[Math.floor(Math.random() * SPEECH_LINES.length)];
    speechEl.textContent = line;
    speechEl.classList.add("is-visible");
    clearTimeout(speechHideTimer);
    speechHideTimer = setTimeout(function () {
      speechEl.classList.remove("is-visible");
    }, SPEECH_VISIBLE_MS);
    maybeShakeHead();
  }

  function scheduleSpeechBubble() {
    clearTimeout(speechShowTimer);
    speechShowTimer = setTimeout(function () {
      showSpeechBubble();
      scheduleSpeechBubble();
    }, randomDelay(5000, 10000)); // random gap, every 5-10s
  }

  function startBubbles() {
    scheduleSpeechBubble();
  }

  function stopBubbles() {
    clearTimeout(speechShowTimer);
    clearTimeout(speechHideTimer);
    clearTimeout(dreadTimer);
    speechShowTimer = null;
    speechHideTimer = null;
    if (speechEl) speechEl.classList.remove("is-visible");
    pin.classList.remove("is-dreading");
  }

  // ---- continuous side->centre position (see updateLitigantPosition) ----
  var MOBILE_BREAKPOINT = 860; // matches the CSS media query that disables this entirely
  var targetCenterT = 0;   // 0 = side (beats 0-1), 1 = centred (beats 2-7)
  var smoothCenterT = 0;   // eased toward targetCenterT every frame, for a settled feel
  var centerTickPending = false;

  function smoothstep(t) {
    return t * t * (3 - 2 * t);
  }

  function updateLitigantPosition() {
    centerTickPending = false;
    if (!litigantStage) return;

    if (window.innerWidth <= MOBILE_BREAKPOINT) {
      litigantStage.style.transform = ""; // CSS !important rule owns mobile anyway; keep inline clean
      return;
    }

    smoothCenterT += (targetCenterT - smoothCenterT) * 0.15;
    if (Math.abs(targetCenterT - smoothCenterT) < 0.0008) smoothCenterT = targetCenterT;

    var x = (smoothCenterT * 25).toFixed(3);
    var y = (smoothCenterT * -9).toFixed(3);
    litigantStage.style.transform = "translate(" + x + "vw, " + y + "vh)";

    if (smoothCenterT !== targetCenterT) {
      centerTickPending = true;
      requestAnimationFrame(updateLitigantPosition);
    }
  }

  function requestCenterTick() {
    if (!centerTickPending) {
      centerTickPending = true;
      requestAnimationFrame(updateLitigantPosition);
    }
  }

  function resetIdle() {
    pin.classList.remove("is-idle");
    stopBubbles();
    clearTimeout(idleTimeout);
    idleTimeout = setTimeout(function () {
      pin.classList.add("is-idle");
      startBubbles();
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
    var beatFloat = progress * (numBeats - 1); // continuous, e.g. 2.4 -- not rounded

    // only run the story mechanics while the story section is actually
    // on screen (rect.top <= 0 and rect.bottom >= 0 roughly, i.e. pinned)
    var inStory = rect.top <= 1 && rect.bottom >= viewportH - 1;

    if (progress <= 0) {
      setActiveBeat(0);
    } else if (progress >= 1) {
      setActiveBeat(numBeats - 1);
    } else if (inStory || rect.top < 0) {
      var nearest = clamp(Math.round(beatFloat), 0, numBeats - 1);
      setActiveBeat(nearest);
    }

    // she starts sliding toward centre as soon as beat 1 begins and is fully
    // there by beat 2 -- a continuous function of scroll position (not a
    // discrete flip at the beat boundary), which is what actually makes it
    // feel smooth: the motion is exactly as fast as the user's scrolling,
    // never a fixed-duration animation firing at one scroll pixel.
    targetCenterT = smoothstep(clamp(beatFloat - 1, 0, 1));
    requestCenterTick();

    if (progressFill) progressFill.style.width = (progress * 100).toFixed(1) + "%";

    setWalking(true);
    clearTimeout(walkTimeout);
    walkTimeout = setTimeout(function () {
      setWalking(false);
    }, 180);
  }

  function requestTick() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(onScrollFrame);
    }
  }

  window.addEventListener("scroll", requestTick, { passive: true });
  window.addEventListener("resize", requestTick);

  // resetIdle is bound directly to the real "scroll" event (not folded into
  // the rAF-throttled onScrollFrame above) so idle/bubble state reacts to
  // "the page has started scrolling" precisely, and isn't tied to whichever
  // frame onScrollFrame happens to run on.
  window.addEventListener("scroll", resetIdle, { passive: true });

  // initial state
  setActiveBeat(0);
  onScrollFrame();

  // she looks around and speech bubbles start immediately on page load --
  // not after the usual 10s idle wait, which only applies once scrolling
  // has actually happened at least once (see resetIdle above).
  pin.classList.add("is-idle");
  startBubbles();
})();
