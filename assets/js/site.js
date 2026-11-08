// Page behaviour: full-screen slide deck (home), reveals, counters, globe drag,
// then start the ASCII scenes. Case pages use the reveal part only.
(function () {
  "use strict";
  var root = document.documentElement;
  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fmt = function (n) { return n.toLocaleString("en-US"); };
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };

  // ---- Hero globe: replay counter + drag to spin ---------------------------
  var globe = document.querySelector("canvas[data-scene='globe'][data-hero]");
  var counter = document.getElementById("replay-count");
  if (globe && counter) {
    globe.__onHit = function (n) { counter.textContent = fmt(n); };
    if (REDUCED) counter.textContent = fmt(162823);
    var lastX = null;
    globe.addEventListener("pointerdown", function (e) { lastX = e.clientX; globe.setPointerCapture(e.pointerId); globe.classList.add("grab"); });
    globe.addEventListener("pointermove", function (e) {
      if (lastX === null || !globe.__grid) return;
      globe.__grid.scene.drag(e.clientX - lastX); lastX = e.clientX;
    });
    ["pointerup", "pointercancel"].forEach(function (t) { globe.addEventListener(t, function () { lastX = null; globe.classList.remove("grab"); }); });
  }

  // ---- Count-up figures -----------------------------------------------------
  function countUp(el) {
    var end = parseFloat(el.getAttribute("data-count")), t0 = null, dur = 1300;
    if (REDUCED) { el.textContent = fmt(end); return; }
    (function step(now) {
      if (!t0) t0 = now;
      var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 4);
      el.textContent = fmt(Math.round(end * e));
      if (p < 1) requestAnimationFrame(step);
    })(performance.now());
  }

  // ---- Hero name: letters settle out of ASCII glyphs -----------------------
  function decodeName() {
    var h = document.querySelector("[data-decode]");
    if (!h || REDUCED || h.__done) return;
    h.__done = true;
    var text = h.textContent, RAMP = ".:-=+*#%@";
    h.setAttribute("aria-label", text);
    h.textContent = "";
    var cells = text.split("").map(function (c) {
      var s = document.createElement("span");
      s.className = "ch"; s.setAttribute("aria-hidden", "true");
      s.textContent = c === " " ? " " : c;
      h.appendChild(s);
      return { el: s, c: c };
    });
    cells.forEach(function (k) { k.el.style.width = k.el.getBoundingClientRect().width + "px"; });
    var t0 = null, STAGGER = 45, SPIN = 300, DELAY = 250;
    (function frame(now) {
      if (t0 === null) t0 = now;
      var done = 0;
      cells.forEach(function (k, i) {
        if (k.c === " ") { done++; return; }
        var local = now - t0 - DELAY - i * STAGGER;
        if (local >= SPIN) { if (k.el.textContent !== k.c) { k.el.classList.remove("g"); k.el.textContent = k.c; } done++; }
        else { k.el.classList.add("g"); k.el.textContent = RAMP[Math.min(RAMP.length - 1, (Math.max(0, local) / SPIN * RAMP.length) | 0)]; }
      });
      if (done < cells.length) requestAnimationFrame(frame);
    })(performance.now());
  }

  // Stagger index for every animated element, per container
  document.querySelectorAll(".slide, .paper, main").forEach(function (s) {
    s.querySelectorAll("[data-anim], .reveal").forEach(function (el, i) { el.style.setProperty("--i", i); });
  });

  var slides = [].slice.call(document.querySelectorAll(".slide"));
  var DECK = root.classList.contains("deck-mode") && slides.length > 1;

  function enterSlide(s) {
    s.querySelectorAll("[data-count]").forEach(function (el) { if (!el.__counted) { el.__counted = true; countUp(el); } });
    if (s.querySelector("[data-decode]")) decodeName();
  }

  if (DECK) deck(); else flow();

  // ---- Normal scrolling (mobile, short screens, reduced motion, case pages) --
  function flow() {
    var targets = document.querySelectorAll("[data-anim], .reveal");
    if (REDUCED || !("IntersectionObserver" in window)) {
      targets.forEach(function (el) { el.classList.add("in"); });
      document.querySelectorAll("[data-count]").forEach(function (el) { el.textContent = fmt(+el.getAttribute("data-count")); });
      return;
    }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        e.target.querySelectorAll("[data-count]").forEach(function (el) { if (!el.__counted) { el.__counted = true; countUp(el); } });
        if (e.target.querySelector("[data-decode]")) decodeName();
        io.unobserve(e.target);
      });
    }, { threshold: 0.12 });
    targets.forEach(function (el) { io.observe(el); });
  }

  // ---- Slide deck -----------------------------------------------------------
  function deck() {
    var cur = 0, busy = false, LEAVE = 420, TOTAL = 1050;
    var rail = document.getElementById("rail");
    var posN = document.getElementById("pos-n"), posT = document.getElementById("pos-t"), posL = document.getElementById("pos-label");
    if (posT) posT.textContent = pad(slides.length);

    var ticks = slides.map(function (s, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.innerHTML = "<span>" + s.getAttribute("data-label") + "</span>";
      b.setAttribute("aria-label", s.getAttribute("data-label"));
      b.addEventListener("click", function () { go(i); });
      rail.appendChild(b);
      return b;
    });

    // Only the visible slide(s) animate their ASCII
    if (window.ASCII) window.ASCII.setGate(function (c) {
      var s = c.closest(".slide");
      return !s || s.classList.contains("is-active") || s.classList.contains("is-leaving");
    });

    function chrome(i) {
      ticks.forEach(function (t, k) { t.classList.toggle("on", k === i); });
      if (posN) posN.textContent = pad(i + 1);
      if (posL) posL.textContent = slides[i].getAttribute("data-label");
      var id = slides[i].id;
      document.querySelectorAll(".frame-top [data-go]").forEach(function (a) {
        var g = a.getAttribute("data-go"), on = g === id || (g === "cases" && /^(cases|cf-)/.test(id));
        if (on && g !== "top") a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
      });
      root.classList.toggle("at-start", i === 0);
      root.classList.toggle("at-end", i === slides.length - 1);
    }

    function go(i, instant) {
      i = Math.max(0, Math.min(slides.length - 1, i));
      if (i === cur && !instant) return;
      if (busy && !instant) return;
      var from = slides[cur], to = slides[i], dir = i > cur ? 1 : -1;
      root.style.setProperty("--dir", dir);
      chrome(i);
      history.replaceState(null, "", i === 0 ? location.pathname : "#" + to.id);
      if (instant) {
        slides.forEach(function (s) { s.classList.remove("is-active", "is-leaving"); s.setAttribute("aria-hidden", "true"); });
        to.classList.add("is-active"); to.removeAttribute("aria-hidden"); to.scrollTop = 0;
        cur = i; enterSlide(to); if (window.ASCII) window.ASCII.enter(to);
        return;
      }
      busy = true;
      from.classList.remove("is-active"); from.classList.add("is-leaving"); from.setAttribute("aria-hidden", "true");
      if (window.ASCII) window.ASCII.leave(from);
      sweep(dir);
      setTimeout(function () {
        from.classList.remove("is-leaving");
        to.scrollTop = 0;
        to.classList.add("is-active"); to.removeAttribute("aria-hidden");
        if (window.ASCII) window.ASCII.enter(to);
        enterSlide(to);
        cur = i;
      }, LEAVE);
      setTimeout(function () { busy = false; }, TOTAL);
    }

    // Wheel: one gesture = one slide, trackpad inertia included
    var lastWheel = 0, acc = 0, used = false;
    window.addEventListener("wheel", function (e) {
      if (e.ctrlKey) return;
      var now = performance.now(), dy = e.deltaY * (e.deltaMode === 1 ? 32 : 1);
      if (now - lastWheel > 180) { acc = 0; used = false; }
      lastWheel = now;
      var s = slides[cur];
      if (canScroll(s, dy, e.target)) return;      // let long slides scroll first
      e.preventDefault();
      if (busy || used) return;
      acc += dy;
      if (Math.abs(acc) > 28) { used = true; go(cur + (acc > 0 ? 1 : -1)); }
    }, { passive: false });

    function canScroll(s, dy, target) {
      var el = target && target.closest ? target.closest(".slide") : null;
      if (el !== s) return false;
      if (s.scrollHeight <= s.clientHeight + 2) return false;
      return dy > 0 ? s.scrollTop + s.clientHeight < s.scrollHeight - 2 : s.scrollTop > 2;
    }

    // Keys
    window.addEventListener("keydown", function (e) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      var t = e.target;
      if (t && /input|textarea|select/i.test(t.tagName)) return;
      var s = slides[cur], k = e.key;
      if (k === "ArrowDown" || k === "PageDown" || (k === " " && !e.shiftKey)) {
        if (k !== " " && canScroll(s, 1, s)) return;
        e.preventDefault(); go(cur + 1);
      } else if (k === "ArrowUp" || k === "PageUp" || (k === " " && e.shiftKey)) {
        if (k !== " " && canScroll(s, -1, s)) return;
        e.preventDefault(); go(cur - 1);
      } else if (k === "Home") { e.preventDefault(); go(0); }
      else if (k === "End") { e.preventDefault(); go(slides.length - 1); }
    });

    // Touch / pen swipe
    var ty = null;
    window.addEventListener("touchstart", function (e) { ty = e.touches[0].clientY; }, { passive: true });
    window.addEventListener("touchend", function (e) {
      if (ty === null) return;
      var dy = ty - e.changedTouches[0].clientY; ty = null;
      if (Math.abs(dy) > 50 && !canScroll(slides[cur], dy, e.target)) go(cur + (dy > 0 ? 1 : -1));
    }, { passive: true });

    // In-page links (#id) move the deck instead of scrolling
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a[href^='#']");
      if (!a) return;
      var id = a.getAttribute("href").slice(1) || "top";
      var i = slides.findIndex(function (s) { return s.id === id; });
      if (i < 0) return;
      e.preventDefault(); go(i);
    });
    // Tabbing into a hidden slide brings it forward
    document.addEventListener("focusin", function (e) {
      var s = e.target.closest && e.target.closest(".slide");
      var i = slides.indexOf(s);
      if (i >= 0 && i !== cur && !busy) go(i);
    });

    window.addEventListener("hashchange", function () { startAt(); });
    function startAt() {
      var id = location.hash.slice(1), i = slides.findIndex(function (s) { return s.id === id; });
      go(i < 0 ? 0 : i, true);
    }
    startAt();

    // ---- The transition sweep: a band of ASCII glyphs crossing the screen ----
    var cv = document.createElement("canvas"), ctx = cv.getContext("2d");
    cv.className = "sweep"; cv.setAttribute("aria-hidden", "true");
    document.body.appendChild(cv);
    var RAMP = " .,:;-=+*#%@", COLORS = ["#1c2f68", "#2e53bd", "#5a86ff", "#b4c8ff"];
    var CW, LH, cols, rows, dpr;
    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = "500 11px 'Geist Mono', ui-monospace, monospace"; ctx.textBaseline = "top";
      CW = ctx.measureText("M").width; LH = 14;
      cols = Math.ceil(innerWidth / CW); rows = Math.ceil(innerHeight / LH);
    }
    size(); window.addEventListener("resize", size);
    function rnd(i) { i = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b); i ^= i >>> 13; i = Math.imul(i, 0xc2b2ae35); i ^= i >>> 16; return (i >>> 0) / 4294967296; }
    function sweep(dir) {
      var t0 = performance.now(), DUR = 900, BAND = 0.15;
      (function frame(now) {
        var p = Math.min(1, (now - t0) / DUR);
        var e = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        var center = dir > 0 ? 1.2 - e * 1.4 : -0.2 + e * 1.4;   // fraction of screen height
        ctx.clearRect(0, 0, innerWidth, innerHeight);
        var seed = Math.floor(now / 45);
        for (var r = 0; r < rows; r++) {
          var y = (r + 0.5) / rows, d = Math.abs(y - center) / BAND;
          if (d > 1) continue;
          var dens = Math.pow(1 - d, 1.6);
          for (var c = 0; c < cols; c++) {
            var h = rnd(r * 4099 + c * 31 + seed);
            if (h > dens * 0.7) continue;
            var lv = Math.min(RAMP.length - 1, 1 + Math.floor(dens * (RAMP.length - 1) * (0.5 + h)));
            ctx.fillStyle = COLORS[Math.min(3, Math.floor(dens * 3.6 * (0.6 + h * 0.6)))];
            ctx.fillText(RAMP[lv], c * CW, r * LH);
          }
        }
        if (p < 1) requestAnimationFrame(frame); else ctx.clearRect(0, 0, innerWidth, innerHeight);
      })(t0);
    }
  }

  if (window.ASCII) window.ASCII.init();
})();
