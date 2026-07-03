(function () {
  "use strict";

  var story = document.getElementById("story");
  var pin = document.getElementById("pin");
  var beatEls = Array.prototype.slice.call(document.querySelectorAll(".beat"));
  var progressFill = document.getElementById("progressFill");
  var beatIndexEl = document.getElementById("beatIndex");
  var beatTotalEl = document.getElementById("beatTotal");
  var litigantStage = document.getElementById("litigantStage");
  var litigantWalker = document.getElementById("litigantWalker");
  var numBeats = beatEls.length;

  if (beatTotalEl) beatTotalEl.textContent = String(numBeats);

  var currentBeat = -1;
  var ticking = false;
  var walkTimeout = null;
  var judgeSeen = false; // beat 3 has actually been on screen this visit

  // ---- Thanos-snap dust for the judge --------------------------------------
  // The judge SVG is rasterised once into an offscreen canvas, sampled into
  // a grid of "grains" (position + colour), and on exit the grains are
  // re-drawn on a visible canvas and swept away left-to-right on the wind
  // -- each grain gets its own delay (sweep + jitter), velocity, and
  // sinusoidal wobble, fading as it flies. The SVG hides at the exact
  // moment the canvas paints every grain at rest, so the handoff is
  // seamless. If any of this fails (no canvas 2d, serialization quirk),
  // js falls back to the CSS turbulence dissolve.
  var judgeDust = {
    ready: false, preparing: false, running: false,
    canvas: null, ctx: null, parts: null, raf: null, dpr: 1, w: 0, h: 0
  };
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function prepareJudgeDust() {
    if (judgeDust.ready || judgeDust.preparing || reduceMotion) return;
    var svg = document.querySelector(".judge-stage .judge");
    var stage = document.querySelector(".judge-stage");
    if (!svg || !stage || !window.HTMLCanvasElement) return;
    var rect = svg.getBoundingClientRect();
    if (rect.width < 40) return; // stage not laid out yet; try again next time
    judgeDust.preparing = true;

    var W = Math.round(rect.width), H = Math.round(rect.height);
    var xml = new XMLSerializer().serializeToString(svg);
    if (xml.indexOf("xmlns=") === -1) {
      xml = xml.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
    }
    var url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml" }));
    var img = new Image();
    img.onload = function () {
      try {
        var off = document.createElement("canvas");
        off.width = W; off.height = H;
        var octx = off.getContext("2d");
        if (!octx) throw new Error("no 2d context");
        octx.drawImage(img, 0, 0, W, H);
        var data = octx.getImageData(0, 0, W, H).data;
        var GAP = 4, parts = [];
        for (var y = 0; y < H; y += GAP) {
          for (var x = 0; x < W; x += GAP) {
            var i = (y * W + x) * 4;
            if (data[i + 3] < 40) continue; // transparent: not part of him
            parts.push({
              x: x, y: y,
              c: "rgb(" + data[i] + "," + data[i + 1] + "," + data[i + 2] + ")",
              // the snap sweeps across him left->right, with jitter so the
              // erosion edge is ragged, not a hard line
              delay: (x / W) * 0.5 + Math.random() * 0.35,
              dur: 0.7 + Math.random() * 0.55,
              vx: 60 + Math.random() * 170,          // carried right on the wind
              vy: -(30 + Math.random() * 120),       // and lifted upward
              wob: 4 + Math.random() * 9,            // sideways flutter
              ph: Math.random() * 6.28
            });
          }
        }
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var cv = document.createElement("canvas");
        cv.className = "judge-dust-canvas";
        cv.width = W * dpr; cv.height = H * dpr;
        stage.insertBefore(cv, stage.querySelector(".judge-dust"));
        judgeDust.canvas = cv;
        judgeDust.ctx = cv.getContext("2d");
        judgeDust.parts = parts;
        judgeDust.dpr = dpr; judgeDust.w = W; judgeDust.h = H;
        judgeDust.ready = true;
      } catch (e) { /* fall back to the CSS dissolve */ }
      URL.revokeObjectURL(url);
      judgeDust.preparing = false;
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      judgeDust.preparing = false;
    };
    img.src = url;
  }

  function runJudgeDust() {
    if (!judgeDust.ready || judgeDust.running) return;
    judgeDust.running = true;
    var ctx = judgeDust.ctx, dpr = judgeDust.dpr;
    var GRAIN = 3.6;
    var start = performance.now();
    function frame(now) {
      if (!judgeDust.running) return;
      var t = (now - start) / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, judgeDust.w, judgeDust.h);
      var alive = false;
      for (var i = 0; i < judgeDust.parts.length; i++) {
        var p = judgeDust.parts[i];
        var lt = (t - p.delay) / p.dur;
        if (lt >= 1) continue;                    // this grain is gone
        alive = true;
        if (lt <= 0) {                            // not yet snapped: at rest
          ctx.globalAlpha = 1;
          ctx.fillStyle = p.c;
          ctx.fillRect(p.x, p.y, GRAIN, GRAIN);
          continue;
        }
        var e = lt * (2 - lt);                    // ease-out
        var x = p.x + p.vx * e * p.dur + Math.sin(p.ph + lt * 9) * p.wob * lt;
        var y = p.y + p.vy * e * p.dur - 40 * lt * lt;
        ctx.globalAlpha = 1 - lt;
        ctx.fillStyle = p.c;
        ctx.fillRect(x, y, GRAIN * (1 - lt * 0.5), GRAIN * (1 - lt * 0.5));
      }
      if (alive) {
        judgeDust.raf = requestAnimationFrame(frame);
      } else {
        judgeDust.running = false;
        ctx.clearRect(0, 0, judgeDust.w, judgeDust.h);
      }
    }
    judgeDust.raf = requestAnimationFrame(frame);
  }

  function stopJudgeDust() {
    judgeDust.running = false;
    if (judgeDust.raf) cancelAnimationFrame(judgeDust.raf);
    if (judgeDust.ctx) {
      judgeDust.ctx.setTransform(judgeDust.dpr, 0, 0, judgeDust.dpr, 0, 0);
      judgeDust.ctx.clearRect(0, 0, judgeDust.w, judgeDust.h);
    }
  }

  var judgeExitActive = false;
  function startJudgeExit() {
    if (judgeExitActive) return;
    judgeExitActive = true;
    if (reduceMotion) return; // beats 4+ hide his stage plainly; no theatrics
    if (judgeDust.ready) {
      pin.classList.add("is-judge-exit");
      runJudgeDust();
    } else {
      pin.classList.add("is-judge-exit", "is-judge-exit-fallback");
    }
  }
  function cancelJudgeExit() {
    if (!judgeExitActive) return;
    judgeExitActive = false;
    stopJudgeDust();
    pin.classList.remove("is-judge-exit", "is-judge-exit-fallback");
  }
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

  // Random per-appearance tilt (see --bubble-tilt / bubbleJitter in
  // style.css) -- re-rolled every time a bubble is shown, idle or scripted,
  // so no two bubbles sit at exactly the same angle.
  function pickBubbleTilt() {
    return (Math.random() * 10 - 5).toFixed(1) + "deg"; // -5deg .. 5deg
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
    speechEl.style.setProperty("--bubble-tilt", pickBubbleTilt());
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

  // ---- "running in late" entrance -----------------------------------------
  // Plays every time the story is entered from the intro hero (see the
  // section-based existence check in onScrollFrame) and on every genuine
  // beat transition back to 0 (see the hook in setActiveBeat below) --
  // not just the first time.
  //
  // She's invisible (opacity:0) by default -- see .litigant-stage in
  // style.css -- and .pin.is-revealed is the ONLY thing that ever makes her
  // visible again (a plain, permanent opacity:1 rule, never removed once
  // added). .pin.is-entrance layers @keyframes lateWalkIn on top of that
  // while it's active: she fades in and drops down from off-screen at the
  // top, so the very first time she appears at all, it reads as "walking
  // into frame," not "just there." Every later beat-0 arrival re-adds
  // .is-entrance, which restarts that keyframe animation from its 0%
  // (opacity:0) -- so she briefly vanishes and walks back in again each
  // time, which is intentional/consistent with the "every time" replay.
  var LATE_LINE = "OMG! I'm so late to get to court!";
  // No scroll lock any more -- the old overflow:hidden lock slammed the
  // page to a dead stop mid-scroll-gesture, which read as the page itself
  // jerking (half of the "super jerky" complaint; the other half was the
  // multi-stop keyframes, see lateWalkIn in style.css). The entrance now
  // plays *around* the user's scrolling instead of fighting it: she walks
  // in over ~1.15s, the bubble shows, and normal scroll behaviour is
  // never interrupted.
  var ENTRANCE_MS = 2400;              // is-entrance/is-running lifetime (walk-in itself is 2.2s -- keep this slightly longer so her feet don't stop before she does)
  var ENTRANCE_BUBBLE_DELAY_MS = 2050; // she "speaks" as she lands -- the bubble is anchored to the stage (which no longer descends with her), so showing it mid-air would leave it floating where her head hadn't arrived yet
  var ENTRANCE_BUBBLE_VISIBLE_MS = 1500;
  var entranceEndTimer = null;
  var entranceBubbleTimer = null;

  function playLateEntrance() {
    // Never fire mid-jump -- see cleanJumpTo() below: a "skip to
    // Collaborate" jump that passes through (or lands exactly on) beat 0
    // shouldn't trigger run-in theatrics on a section the user is leaving.
    if (isJumpingToSection) return;
    // This scripted line takes priority over -- and interrupts -- whatever
    // the ordinary idle-bubble cycle was doing.
    stopBubbles();
    clearTimeout(entranceEndTimer);
    clearTimeout(entranceBubbleTimer);

    pin.classList.add("is-revealed", "is-entrance", "is-running", "is-walking");

    entranceBubbleTimer = setTimeout(function () {
      if (!speechEl) return;
      speechEl.textContent = LATE_LINE;
      speechEl.style.setProperty("--bubble-tilt", pickBubbleTilt());
      speechEl.classList.add("is-visible");
      // the bubble outlives the entrance classes slightly; speechHideTimer
      // is the same handle stopBubbles()/dereveal clear, so a scroll-away
      // still kills it instantly.
      clearTimeout(speechHideTimer);
      speechHideTimer = setTimeout(function () {
        speechEl.classList.remove("is-visible");
      }, ENTRANCE_BUBBLE_VISIBLE_MS);
    }, ENTRANCE_BUBBLE_DELAY_MS);

    entranceEndTimer = setTimeout(function () {
      pin.classList.remove("is-entrance", "is-running");
      setWalking(false); // stop cleanly, "on the spot" -- ordinary scroll-driven walking resumes on the next real scroll
    }, ENTRANCE_MS);
  }

  // Fallback for the one case playLateEntrance doesn't cover: if the
  // user's first real scroll is fast/far enough to skip beat 0 entirely
  // (landing straight on, say, beat 2), she'd otherwise stay at opacity:0
  // -- invisible -- since nothing else adds .is-revealed. This just
  // reveals her plainly (a quick CSS transition, no walk-in theatrics --
  // there's no "arriving at beat 0" moment to tie a run-in to here).
  function revealLitigantPlainly() {
    pin.classList.add("is-revealed");
  }

  // The reverse of the reveal: while the intro hero (the section ABOVE the
  // story) owns the screen, she must not exist at all -- so the next trip
  // down into the story gets a fresh walk-in every time, not just on first
  // load. Removing .is-revealed drops .litigant-stage back to opacity:0;
  // any in-flight entrance is cancelled and its scroll lock released so
  // a fast scroll up mid-run-in can't strand the page locked.
  function derevealLitigant() {
    if (!pin.classList.contains("is-revealed")) return;
    clearTimeout(entranceEndTimer);
    clearTimeout(entranceBubbleTimer);
    pin.classList.remove("is-revealed", "is-entrance", "is-running");
    if (speechEl) speechEl.classList.remove("is-visible");
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
    if (!litigantWalker) return;

    if (window.innerWidth <= MOBILE_BREAKPOINT) {
      litigantWalker.style.transform = ""; // CSS !important rule owns mobile anyway; keep inline clean
      return;
    }

    smoothCenterT += (targetCenterT - smoothCenterT) * 0.15;
    if (Math.abs(targetCenterT - smoothCenterT) < 0.0008) smoothCenterT = targetCenterT;

    // Targets .litigant-walker (figure + shadow + bubble), NOT the stage:
    // the road stays behind on the left so SHE walks to the centre rather
    // than the whole scene panning there ("not have the whole thing move").
    // The constant -12vh midline lift lives on .litigant-stage in CSS; the
    // extra -6vh here keeps the bottom-left text clear once she's centred.
    var x = (smoothCenterT * 25).toFixed(3);
    var y = (smoothCenterT * -6).toFixed(3);
    litigantWalker.style.transform = "translate(" + x + "vw, " + y + "vh)";

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

  // ---- beat 2 pendency queue ----------------------------------------------
  // Four clones of the litigant, coats recoloured, queued in front of
  // (below, +%) and behind (above, -%) her. Built once here; everything
  // about how/when they move is CSS driven off .pin[data-beat] -- see
  // .queue-fig in style.css. Slots are ±105/±210% of a figure's own height
  // -- a full figure plus a small gap -- so neighbours never overlap her
  // or each other. Clones drop their id/aria and their <defs> (clip-path
  // url() refs resolve to the original's defs, and duplicating ids would
  // be invalid); they keep the .litigant class so the ordinary walk-cycle
  // rules animate their legs whenever the page scrolls or the queue loop
  // runs.
  var QUEUE = [
    { slot: "-210%", coat: "#4e6e8e" }, // behind, far
    { slot: "-105%", coat: "#7d8a4a" }, // behind, near
    { slot: "105%",  coat: "#b3775a" }, // in front, near
    { slot: "210%",  coat: "#c05f7c" }  // in front, far
  ];

  (function buildQueue() {
    var src = document.getElementById("litigant");
    if (!src || !litigantStage) return;
    QUEUE.forEach(function (q) {
      var clone = src.cloneNode(true);
      clone.removeAttribute("id");
      clone.removeAttribute("role");
      clone.removeAttribute("aria-label");
      clone.setAttribute("aria-hidden", "true");
      var defs = clone.querySelector("defs");
      if (defs) defs.parentNode.removeChild(defs);
      Array.prototype.forEach.call(clone.querySelectorAll('[fill="#754a76"]'), function (p) {
        p.setAttribute("fill", q.coat); // the coat -- their "t-shirt colour"
      });
      clone.classList.add("queue-fig");
      clone.style.setProperty("--q-slot", q.slot);
      litigantStage.appendChild(clone);
    });
  })();

  // Set true the first time a genuine "scroll" event fires (see the
  // listener bound to resetIdle further down) -- guards the entrance
  // hook in setActiveBeat below from firing on the synthetic setActiveBeat(0)
  // call that runs once at page load, before the user has scrolled at all
  // (she shouldn't "run in late" before anyone's even left the intro hero).
  var hasScrolledOnce = false;

  function resetIdle() {
    hasScrolledOnce = true;
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

    // Every genuine transition into beat 0 -- whether arriving from the
    // intro hero above, or scrolling back up into it from beat 1 -- replays
    // the run-in. hasScrolledOnce excludes only the one synthetic call this
    // function gets at page load, before any real scrolling has happened.
    if (hasScrolledOnce) {
      if (index === 0) {
        playLateEntrance();
      } else if (!pin.classList.contains("is-revealed")) {
        // First real scroll skipped beat 0 entirely (fast fling landed
        // straight on a later beat) -- see revealLitigantPlainly() above.
        revealLitigantPlainly();
      }
    }
  }

  function setWalking(isWalking) {
    if (isWalking) {
      pin.classList.add("is-walking");
    } else {
      // The ordinary 180ms walkTimeout below fires on a fixed delay from
      // whichever scroll frame armed it -- including the very frame that
      // triggers playLateEntrance(), which needs .is-walking held for the
      // full ~1.7s lock, not just 180ms. Entrance owns the walking state
      // while it's active; it calls setWalking(false) itself once it's
      // already removed .is-entrance, so this guard never blocks that.
      if (pin.classList.contains("is-entrance")) return;
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

    // she stays on the LEFT through beats 0-3 (intro, invisible-litigant,
    // the pendency queue, and the judge's bench -- where she's absent
    // anyway), then slides toward centre across beat 4's approach -- a
    // continuous function of scroll position (not a discrete flip at the
    // beat boundary), which is what actually makes it feel smooth: the
    // motion is exactly as fast as the user's scrolling, never a
    // fixed-duration animation firing at one scroll pixel.
    targetCenterT = smoothstep(clamp(beatFloat - 3, 0, 1));
    requestCenterTick();

    // ---- judge dissolution, scroll-driven -------------------------------
    // The snap must FINISH before beat 4's content is on screen ("i don't
    // like how the judge is still fading out as the next screen is already
    // active"), so it isn't hooked to the beat CHANGE (which happens at
    // beatFloat 3.5, too late) -- it starts at 3.3, while his section is
    // still the active one, and the sweep completes in ~1.6s. `judgeSeen`
    // stops a direct landing on a later beat from flashing a judge the
    // visitor never saw; scrolling back below the threshold reassembles
    // him (the canvas clears and the SVG un-hides). The particle field is
    // prepared while the visitor is still LOOKING at beat 3, so the snap
    // starts with zero rasterisation lag.
    if (currentBeat === 3) {
      judgeSeen = true;
      prepareJudgeDust();
    }
    if (judgeSeen && beatFloat >= 3.3) startJudgeExit();
    else cancelJudgeExit();

    // ---- section-based existence -------------------------------------
    // While the intro hero owns the screen (story still mostly below the
    // fold), she doesn't exist. The moment the story actually pins
    // (rect.top reaches 0), she walks in from the top -- every time the
    // story is entered from the hero, not just on first load. This is
    // scroll-position-driven rather than beat-transition-driven because
    // currentBeat sits at 0 both at the hero AND at the story's first
    // beat, so setActiveBeat alone can never see a hero->story crossing.
    if (rect.top > viewportH * 0.5) {
      derevealLitigant(); // hero is the current section: she's gone
    } else if (rect.top <= 1 && !pin.classList.contains("is-revealed") && !isJumpingToSection) {
      if (beatFloat < 0.5) {
        playLateEntrance();       // arrived at the story's opening: run in
      } else {
        revealLitigantPlainly();  // landed mid-story (fast fling / jump)
      }
    }

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

  // ---- clean jump past the story (e.g. "Collaborate") ---------------------
  // html has `scroll-behavior: smooth` globally, so a plain anchor link to
  // a section that comes AFTER the 8-screen-tall .story would natively
  // smooth-scroll straight through it -- dragging the visible page through
  // every beat's background colour, litigant walk-cycle, and count-up stat
  // animation in well under a second, which just looks like a fast, broken
  // flicker. It could also let a fast scroll pass through beat 0 while
  // .story is mid-transit, which -- pre this fix -- could trigger
  // playLateEntrance() and try to lock scroll while the browser's own
  // scroll animation toward Collaborate is still running, fighting it.
  //
  // Fixed by intercepting clicks on any link that jumps to "#collaborate"
  // (there are two: the intro hero's button, and the nav link) and doing an
  // instant, non-smooth scrollIntoView instead -- this bypasses the
  // story's scroll range in one jump rather than animating through it, so
  // there's no intermediate frame where the beats are visibly flashing by.
  // isJumpingToSection also blocks playLateEntrance for the (now much
  // smaller, but not impossible) window while that jump is in flight.
  var isJumpingToSection = false;

  function cleanJumpTo(targetId) {
    var target = document.getElementById(targetId);
    if (!target) return;
    isJumpingToSection = true;
    // "instant", not "auto" -- per spec, behavior:"auto" defers to the
    // element's CSS scroll-behavior, and html has scroll-behavior:smooth
    // set globally, so "auto" was actually still smooth-scrolling the
    // whole way through .story (the exact thing this was meant to avoid).
    // "instant" unconditionally overrides that and jumps in one step.
    target.scrollIntoView({ behavior: "instant", block: "start" });
    // Give the browser a moment to actually land and fire whatever
    // scroll/resize events result from the jump before re-arming normal
    // scroll-driven behaviour.
    setTimeout(function () {
      isJumpingToSection = false;
    }, 300);
  }

  Array.prototype.slice.call(document.querySelectorAll('a[href="#collaborate"]')).forEach(function (link) {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      cleanJumpTo("collaborate");
    });
  });

  window.addEventListener("scroll", requestTick, { passive: true });
  window.addEventListener("resize", requestTick);

  // ---------------- Collaborate entrance transition ---------------------
  // Heading, filters, and job cards fade/rise in EVERY time the section
  // is arrived at (explicit request: "always trigger, either when
  // collaborate is clicked, or when scrolling there") -- one
  // IntersectionObserver covers both paths, since a cleanJumpTo() click
  // still ends with the section intersecting the viewport.
  //
  // Replay mechanics: .is-in is added when at least 15% of the section is
  // visible, and only removed once the section has left the viewport
  // ENTIRELY (isIntersecting false at threshold 0) -- removing it at the
  // same 15% line would visibly blank content that's still on screen
  // while scrolling away. Re-adding the class restarts the entrance
  // keyframes from 0, so the stagger replays on each visit.
  var collaborateSection = document.getElementById("collaborate");
  if (collaborateSection && "IntersectionObserver" in window) {
    // Only commit to hiding things via .js-reveal once we can also
    // guarantee an observer exists to reveal them again -- otherwise a
    // browser without IntersectionObserver support would leave everything
    // permanently invisible with nothing left to trigger the reveal.
    collaborateSection.classList.add("js-reveal");
    Array.prototype.slice.call(collaborateSection.querySelectorAll(".collab-card")).forEach(function (card, i) {
      // Cap the stagger index so a long job list doesn't push the last
      // few cards' entrance delay out to something that reads as sluggish.
      card.style.setProperty("--i", Math.min(i, 10));
    });
    var collabRevealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.15) {
            collaborateSection.classList.add("is-in");
          } else if (!entry.isIntersecting) {
            collaborateSection.classList.remove("is-in");
          }
          // between 0 and 15% visible: keep whatever state it has
        });
      },
      { threshold: [0, 0.15] }
    );
    collabRevealObserver.observe(collaborateSection);
  }

  // resetIdle is bound directly to the real "scroll" event (not folded into
  // the rAF-throttled onScrollFrame above) so idle/bubble state reacts to
  // "the page has started scrolling" precisely, and isn't tied to whichever
  // frame onScrollFrame happens to run on.
  window.addEventListener("scroll", resetIdle, { passive: true });

  // initial state
  setActiveBeat(0);
  onScrollFrame();

  // Reset currentBeat back to -1 right after the synthetic seeding above.
  // Without this, the page loads with currentBeat already at 0 (beat 0 is
  // visually correct from the very first frame, before any real scrolling),
  // so the FIRST real scroll from the intro hero into the story would see
  // index(0) === currentBeat(0) and setActiveBeat's guard would return
  // early -- no detected transition, so playLateEntrance() would never
  // fire for what should be the most important trigger: the user's actual
  // first arrival at beat 0. hasScrolledOnce still gates it from firing
  // before any real scrolling happens, so this is safe.
  currentBeat = -1;

  // she looks around and speech bubbles start immediately on page load --
  // not after the usual 10s idle wait, which only applies once scrolling
  // has actually happened at least once (see resetIdle above).
  pin.classList.add("is-idle");
  startBubbles();
})();
