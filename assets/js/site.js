// Page behaviour: scroll reveals, counters, globe interaction, then start the ASCII scenes.
(function () {
  "use strict";
  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fmt = function (n) { return n.toLocaleString("en-US"); };

  // Hero globe: replay counter + drag to spin
  var globe = document.querySelector("canvas[data-scene='globe'][data-hero]");
  var counter = document.getElementById("replay-count");
  if (globe && counter) {
    globe.__onHit = function (n, total) {
      counter.textContent = fmt(n);
      if (n >= total) counter.parentNode.classList.add("done");
    };
    if (REDUCED) counter.textContent = fmt(162823);
    var lastX = null;
    globe.addEventListener("pointerdown", function (e) { lastX = e.clientX; globe.setPointerCapture(e.pointerId); globe.classList.add("grab"); });
    globe.addEventListener("pointermove", function (e) {
      if (lastX === null || !globe.__grid) return;
      globe.__grid.scene.drag(e.clientX - lastX); lastX = e.clientX;
    });
    ["pointerup", "pointercancel"].forEach(function (t) { globe.addEventListener(t, function () { lastX = null; globe.classList.remove("grab"); }); });
  }

  // Hovering a case row spins its object faster
  document.querySelectorAll("[data-spin-host]").forEach(function (host) {
    var cv = host.querySelector("canvas[data-scene]");
    if (!cv) return;
    host.addEventListener("mouseenter", function () { if (cv.__grid) cv.__grid.targetSpeed = 3.2; });
    host.addEventListener("mouseleave", function () { if (cv.__grid) cv.__grid.targetSpeed = 1; });
  });

  // Count-up figures
  function countUp(el) {
    var end = parseFloat(el.getAttribute("data-count")), t0 = null, dur = 1400;
    if (REDUCED) { el.textContent = fmt(end); return; }
    (function step(now) {
      if (!t0) t0 = now;
      var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 4);
      el.textContent = fmt(Math.round(end * e));
      if (p < 1) requestAnimationFrame(step);
    })(performance.now());
  }

  // Reveal on scroll
  var targets = document.querySelectorAll(".reveal, [data-count]");
  if (REDUCED || !("IntersectionObserver" in window)) {
    targets.forEach(function (el) { el.classList.add("in"); if (el.hasAttribute("data-count")) el.textContent = fmt(+el.getAttribute("data-count")); });
  } else {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        if (e.target.hasAttribute("data-count")) countUp(e.target);
        io.unobserve(e.target);
      });
    }, { threshold: 0.15 });
    targets.forEach(function (el) { io.observe(el); });
  }

  // ---- Hero name: letters settle out of ASCII glyphs, left to right, once ----
  (function decodeName() {
    var h = document.querySelector("[data-decode]");
    if (!h || REDUCED) return;
    var text = h.textContent, RAMP = ".:-=+*#%@";
    h.style.visibility = "hidden";                 // no flash of the plain name before it decodes
    function setup() {
    h.style.visibility = "";
    h.setAttribute("aria-label", text);
    h.textContent = "";
    var cells = text.split("").map(function (c) {
      var s = document.createElement("span");
      s.className = "ch"; s.setAttribute("aria-hidden", "true");
      s.textContent = c === " " ? " " : c;
      h.appendChild(s);
      return { el: s, c: c };
    });
    // lock each letter's final width so the glyphs never shift the layout
    cells.forEach(function (k) { k.el.style.width = k.el.getBoundingClientRect().width + "px"; });
    var t0 = null, STAGGER = 55, SPIN = 260;
    function frame(now) {
      if (t0 === null) t0 = now;
      var done = 0;
      cells.forEach(function (k, i) {
        if (k.c === " ") { done++; return; }
        var local = now - t0 - i * STAGGER;
        if (local >= SPIN) {
          if (k.el.classList.contains("g") || k.el.textContent !== k.c) { k.el.classList.remove("g"); k.el.textContent = k.c; }
          done++;
        } else {
          k.el.classList.add("g");
          var p = Math.max(0, local) / SPIN;           // climb the ramp: sparse dots → dense glyphs
          k.el.textContent = RAMP[Math.min(RAMP.length - 1, (p * RAMP.length) | 0)];
        }
      });
      if (done < cells.length) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(setup); else setup();
  })();

  // ---- Glass: highlight follows the pointer ---------------------------------
  var GLASS = ".glass, .cases a, .figures > a, .small-work a, .map-grid, .btn";
  document.addEventListener("pointermove", function (e) {
    var el = e.target.closest && e.target.closest(GLASS);
    if (!el) return;
    var r = el.getBoundingClientRect();
    el.style.setProperty("--mx", (e.clientX - r.left) + "px");
    el.style.setProperty("--my", (e.clientY - r.top) + "px");
  }, { passive: true });

  if (window.ASCII) window.ASCII.init();
})();
