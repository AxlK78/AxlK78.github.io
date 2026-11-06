// ASCII 3D renderer: draws ray-marched solids, wireframes and an attack globe
// as characters on a <canvas>. No dependencies.
(function () {
  "use strict";

  var RAMP = " .,-~:;=!*#$@";
  // dim navy -> electric blue -> ice. Index 9.. are accents.
  var PAL = ["#16234d", "#1c2f68", "#243f8f", "#2e53bd", "#3b6ae6", "#5a86ff", "#86a6ff", "#b4c8ff", "#e3ecff",
             "#5ef0ff", "#ffffff", "#2a8fa8"];
  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- small vector helpers ----------
  function rotX(v, a) { var c = Math.cos(a), s = Math.sin(a); return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c]; }
  function rotY(v, a) { var c = Math.cos(a), s = Math.sin(a); return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c]; }
  function len3(x, y, z) { return Math.sqrt(x * x + y * y + z * z); }
  function hash(i) { i = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b); i ^= i >>> 13; i = Math.imul(i, 0xc2b2ae35); i ^= i >>> 16; return (i >>> 0) / 4294967296; }

  // ---------- grid / canvas ----------
  function Grid(canvas, scene, fontPx) {
    this.c = canvas; this.ctx = canvas.getContext("2d"); this.scene = scene;
    this.fontPx = fontPx; this.t = 0; this.speed = 1; this.targetSpeed = 1;
    this.running = false; this.last = 0; this.age = 0;
    this.resize();
  }
  Grid.prototype.resize = function () {
    var r = this.c.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = Math.max(1, r.width); this.H = Math.max(1, r.height);
    this.c.width = Math.round(this.W * dpr); this.c.height = Math.round(this.H * dpr);
    var ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var fs = typeof this.fontPx === "function" ? this.fontPx(this.W) : this.fontPx;
    ctx.font = "500 " + fs + "px 'Geist Mono', ui-monospace, monospace";
    ctx.textBaseline = "top";
    this.cw = ctx.measureText("M").width; this.lh = Math.round(fs * 1.18);
    this.cols = Math.floor(this.W / this.cw); this.rows = Math.floor(this.H / this.lh);
    var n = this.cols * this.rows;
    this.ch = new Array(n); this.lum = new Float32Array(n); this.kind = new Uint8Array(n);
    this.ox = (this.W - this.cols * this.cw) / 2; this.oy = (this.H - this.rows * this.lh) / 2;
  };
  Grid.prototype.put = function (c, r, ch, lum, kind) {
    c = Math.round(c); r = Math.round(r);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return;
    var i = r * this.cols + c;
    if (kind || lum >= this.lum[i] || this.ch[i] === " ") { this.ch[i] = ch; this.lum[i] = lum; this.kind[i] = kind || 0; }
  };
  Grid.prototype.frame = function (dt) {
    this.speed += (this.targetSpeed - this.speed) * Math.min(1, dt * 4);
    this.t += dt * this.speed; this.age += dt;
    this.ch.fill(" "); this.lum.fill(0); this.kind.fill(0);
    this.scene.render(this, this.t, dt);
    this.draw();
  };
  Grid.prototype.draw = function () {
    var ctx = this.ctx, cols = this.cols, n = this.ch.length;
    ctx.clearRect(0, 0, this.W, this.H);
    var intro = REDUCED ? 1 : Math.min(1, this.age / 1.3);
    var buckets = []; for (var b = 0; b < PAL.length; b++) buckets.push([]);
    for (var i = 0; i < n; i++) {
      var ch = this.ch[i]; if (ch === " ") continue;
      var bi = this.kind[i] ? 8 + this.kind[i] : Math.max(0, Math.min(8, Math.floor(this.lum[i] * 9)));
      if (intro < 1 && hash(i) > intro) {             // materialise effect
        ch = RAMP[1 + Math.floor(hash(i + Math.floor(this.age * 20)) * (RAMP.length - 1))];
        bi = Math.max(0, bi - 3);
      }
      buckets[bi].push(i, ch);
    }
    for (b = 0; b < buckets.length; b++) {
      var L = buckets[b]; if (!L.length) continue;
      ctx.fillStyle = PAL[b];
      for (var k = 0; k < L.length; k += 2) {
        var idx = L[k];
        ctx.fillText(L[k + 1], this.ox + (idx % cols) * this.cw, this.oy + Math.floor(idx / cols) * this.lh);
      }
    }
  };
  // pixel helpers shared by scenes: world unit -> pixels
  function unitPx(g, extent) { return Math.min(g.W, g.H) / 2 / extent; }

  // ---------- ray-marched solids ----------
  function sdBox(x, y, z, bx, by, bz) {
    var qx = Math.abs(x) - bx, qy = Math.abs(y) - by, qz = Math.abs(z) - bz;
    return len3(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, Math.max(qy, qz)), 0);
  }
  var SDF = {
    rack: { extent: 1.05, f: function (x, y, z) {
      var d = 1e9;
      for (var i = -1; i <= 1; i++) d = Math.min(d, sdBox(x, y - i * 0.44, z, 0.74, 0.15, 0.5) - 0.035);
      return d;
    } },
    container: { extent: 1.1, f: function (x, y, z) {
      var d = sdBox(x, y, z, 0.95, 0.4, 0.4) - 0.02;
      return d + 0.014 * Math.sin(x * 38);              // corrugated walls
    } },
    torus: { extent: 1.0, f: function (x, y, z) {
      var q = Math.sqrt(x * x + z * z) - 0.66;
      return Math.sqrt(q * q + y * y) - 0.28;
    } }
  };

  function solidScene(name, opts) {
    var S = SDF[name]; opts = opts || {};
    var tilt = opts.tilt == null ? 0.45 : opts.tilt;
    return { render: function (g, t) {
      var a = t * (opts.spin || 0.6), u = unitPx(g, S.extent);
      var tl = tilt + Math.sin(t * 0.37) * 0.12;
      // view -> object: Ry(-a) * Rx(-tl)
      function M(v) { return rotY(rotX(v, -tl), -a); }
      var ex = M([1, 0, 0]), ey = M([0, 1, 0]), dir = M([0, 0, -1]), base = M([0, 0, 4]);
      var L = M([-0.45, 0.6, 0.66]);
      var f = S.f, cols = g.cols, rows = g.rows;
      for (var r = 0; r < rows; r++) {
        var y = (g.H / 2 - (g.oy + (r + 0.5) * g.lh)) / u;
        for (var c = 0; c < cols; c++) {
          var x = (g.ox + (c + 0.5) * g.cw - g.W / 2) / u;
          var ox = base[0] + x * ex[0] + y * ey[0], oy = base[1] + x * ex[1] + y * ey[1], oz = base[2] + x * ex[2] + y * ey[2];
          var tt = 2.6, hit = false, px, py, pz;
          for (var s = 0; s < 42; s++) {
            px = ox + dir[0] * tt; py = oy + dir[1] * tt; pz = oz + dir[2] * tt;
            var d = f(px, py, pz);
            if (d < 0.004) { hit = true; break; }
            tt += d; if (tt > 5.4) break;
          }
          if (!hit) continue;
          var e = 0.004;
          var nx = f(px + e, py, pz) - f(px - e, py, pz), ny = f(px, py + e, pz) - f(px, py - e, pz), nz = f(px, py, pz + e) - f(px, py, pz - e);
          var nl = len3(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
          var diff = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
          var facing = -(nx * dir[0] + ny * dir[1] + nz * dir[2]);
          var lum = Math.min(1, 0.1 + 0.8 * diff + 0.25 * Math.pow(1 - Math.max(0, facing), 3));
          g.put(c, r, RAMP[1 + Math.floor(lum * (RAMP.length - 2))], lum, 0);
        }
      }
    } };
  }

  // ---------- wireframe network (icosahedron) ----------
  function netScene() {
    var p = (1 + Math.sqrt(5)) / 2, V = [];
    [[-1, p, 0], [1, p, 0], [-1, -p, 0], [1, -p, 0], [0, -1, p], [0, 1, p], [0, -1, -p], [0, 1, -p], [p, 0, -1], [p, 0, 1], [-p, 0, -1], [-p, 0, 1]]
      .forEach(function (v) { var l = len3(v[0], v[1], v[2]); V.push([v[0] / l, v[1] / l, v[2] / l]); });
    var E = [];
    for (var i = 0; i < 12; i++) for (var j = i + 1; j < 12; j++) {
      var d = len3(V[i][0] - V[j][0], V[i][1] - V[j][1], V[i][2] - V[j][2]); if (d < 1.1) E.push([i, j]);
    }
    return { render: function (g, t) {
      var u = unitPx(g, 1.25), a = t * 0.5, tl = 0.4 + Math.sin(t * 0.3) * 0.15;
      var P = V.map(function (v) { return rotX(rotY(v, a), tl); });
      function scr(v) { return [(g.W / 2 + v[0] * u - g.ox) / g.cw - 0.5, (g.H / 2 - v[1] * u - g.oy) / g.lh - 0.5]; }
      E.forEach(function (e, k) {
        var A = P[e[0]], B = P[e[1]], sa = scr(A), sb = scr(B);
        var dc = sb[0] - sa[0], dr = sb[1] - sa[1];
        var ang = Math.atan2(-dr * g.lh, dc * g.cw), ch;
        var aa = ((ang % Math.PI) + Math.PI) % Math.PI;
        ch = aa < 0.39 || aa > 2.75 ? "-" : aa < 1.18 ? "/" : aa < 1.96 ? "|" : "\\";
        var steps = Math.ceil(Math.max(Math.abs(dc), Math.abs(dr)) * 1.4) + 1;
        for (var s = 0; s <= steps; s++) {
          var q = s / steps, z = A[2] + (B[2] - A[2]) * q;
          g.put(sa[0] + dc * q, sa[1] + dr * q, ch, 0.22 + 0.45 * (z + 1) / 2, 0);
        }
        // packets travelling on some edges
        if (k % 3 === 0) {
          var q2 = (t * 0.6 + k * 0.137) % 1, z2 = A[2] + (B[2] - A[2]) * q2;
          if (z2 > -0.3) g.put(sa[0] + dc * q2, sa[1] + dr * q2, "*", 1, 1);
        }
      });
      P.forEach(function (v) { var s = scr(v); g.put(s[0], s[1], v[2] > 0 ? "@" : "o", 0.6 + 0.4 * (v[2] + 1) / 2, v[2] > 0.2 ? 2 : 0); });
    } };
  }

  // ---------- globe with attack arcs ----------
  function ll(lat, lon) { lat *= Math.PI / 180; lon *= Math.PI / 180; return [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)]; }
  // rough continents as blobs: lat, lon, radius (deg)
  var BLOBS = [[50,-100,22],[40,-95,17],[60,-120,16],[66,-150,10],[30,-100,10],[20,-101,8],[14,-88,6],[73,-40,11],[62,-75,10],
    [-10,-60,18],[-25,-60,13],[-40,-68,8],[5,-68,9],[-5,-40,8],
    [50,10,11],[55,25,12],[45,2,7],[63,16,8],[42,-4,6],[53,-2,4],
    [6,20,18],[16,8,15],[-14,26,14],[-28,25,9],[26,18,14],[10,40,8],
    [56,90,24],[42,100,19],[62,130,18],[30,80,11],[20,78,9],[14,103,8],[36,50,11],[24,46,10],[66,70,18],[48,60,12],[38,127,4],[37,138,4],
    [0,114,8],[-4,138,7],[-24,134,15],[-32,147,6]];
  var BL = BLOBS.map(function (b) { var v = ll(b[0], b[1]); return [v[0], v[1], v[2], Math.cos(b[2] * Math.PI / 180)]; });
  // honeypot top source countries (from the T-Pot data), US weighted
  var SRC = [[37,-122,3],[40,-74,3],[32,-97,3],[41,-87,2],[42.7,25.3,2],[51,10,1],[55.7,37.6,1],[56.8,60.6,1],[21,105.8,1],[10.8,106.6,1],[14.6,121,1]];
  var WSUM = SRC.reduce(function (s, x) { return s + x[2]; }, 0);
  var DST = ll(49.5, 11);

  function globeScene(opts) {
    opts = opts || {};
    var arcs = [], pulses = [], nextArc = 0, total = 0, TARGET = 162823;
    var yawOff = 0, vel = 0;
    var self = {
      onHit: opts.onHit,
      drag: function (dx) { vel = dx * 0.006; yawOff += dx * 0.006; },
      render: function (g, t, dt) {
        yawOff += vel; vel *= 0.92;
        var yaw = -0.6 + t * 0.16 + yawOff, tilt = 0.42;
        var u = unitPx(g, 1.16), cols = g.cols, rows = g.rows;
        var Lx = -0.45, Ly = 0.55, Lz = 0.7, Ll = len3(Lx, Ly, Lz); Lx /= Ll; Ly /= Ll; Lz /= Ll;
        var cy = Math.cos(-yaw), sy = Math.sin(-yaw), ct = Math.cos(-tilt), st = Math.sin(-tilt);
        for (var r = 0; r < rows; r++) {
          var y = (g.H / 2 - (g.oy + (r + 0.5) * g.lh)) / u;
          for (var c = 0; c < cols; c++) {
            var x = (g.ox + (c + 0.5) * g.cw - g.W / 2) / u, d2 = x * x + y * y;
            if (d2 > 1) { if (d2 < 1.06 && hash(r * 977 + c) > 0.55) g.put(c, r, ".", 0.12, 0); continue; }
            var z = Math.sqrt(1 - d2);
            // view -> world: Ry(-yaw) * Rx(-tilt)
            var wy = y * ct - z * st, wz1 = y * st + z * ct;
            var wx = x * cy + wz1 * sy, wz = -x * sy + wz1 * cy;
            var land = false;
            for (var b = 0; b < BL.length; b++) {
              var B = BL[b];
              if (wx * B[0] + wy * B[1] + wz * B[2] > B[3] + 0.02 * Math.sin(wx * 23 + wy * 17) * Math.cos(wz * 19)) { land = true; break; }
            }
            var diff = Math.max(0, x * Lx + y * Ly + z * Lz);
            if (land) {
              var lum = 0.16 + 0.84 * Math.pow(diff, 0.85);
              g.put(c, r, RAMP[3 + Math.floor(lum * (RAMP.length - 4))], lum, 0);
            } else {
              var lat = Math.asin(wy) * 180 / Math.PI, lon = Math.atan2(wx, wz) * 180 / Math.PI;
              var grid = Math.abs(((lat + 90) % 20) - 10) > 9.1 || Math.abs(((lon + 180) % 30) - 15) > 14.2;
              if (grid) g.put(c, r, ".", 0.14 + 0.3 * diff, 0);
              else if (1 - z > 0.82) g.put(c, r, ":", 0.12, 0);   // limb
            }
          }
        }
        // arcs
        if (!REDUCED) {
          nextArc -= dt;
          if (nextArc <= 0) {
            nextArc = 0.22 + Math.random() * 0.35;
            var w = Math.random() * WSUM, s = SRC[0];
            for (var k = 0; k < SRC.length; k++) { w -= SRC[k][2]; if (w <= 0) { s = SRC[k]; break; } }
            var S = ll(s[0] + (Math.random() - 0.5) * 4, s[1] + (Math.random() - 0.5) * 6);
            var om = Math.acos(Math.max(-1, Math.min(1, S[0] * DST[0] + S[1] * DST[1] + S[2] * DST[2])));
            arcs.push({ S: S, om: om, p: 0, dur: 1.1 + om * 0.5 });
          }
        }
        function view(v) {
          var a = rotY(v, yaw); return rotX(a, tilt);
        }
        function plot(v, ch, lum, kind) {
          var q = view(v);
          if (q[2] < 0 && q[0] * q[0] + q[1] * q[1] < 1) return;
          g.put((g.W / 2 + q[0] * u - g.ox) / g.cw - 0.5, (g.H / 2 - q[1] * u - g.oy) / g.lh - 0.5, ch, lum, kind);
        }
        function arcPoint(A, s) {
          var so = Math.sin(A.om) || 1e-6, k1 = Math.sin((1 - s) * A.om) / so, k2 = Math.sin(s * A.om) / so;
          var h = 1 + (0.12 + 0.18 * A.om) * Math.sin(Math.PI * s);
          return [(A.S[0] * k1 + DST[0] * k2) * h, (A.S[1] * k1 + DST[1] * k2) * h, (A.S[2] * k1 + DST[2] * k2) * h];
        }
        for (var i = arcs.length - 1; i >= 0; i--) {
          var A = arcs[i]; A.p += dt / A.dur;
          var head = Math.min(1, A.p), tail = Math.max(0, A.p - 0.45);
          for (var q = tail; q <= head; q += 0.012) {
            var f = (q - tail) / Math.max(0.001, head - tail);
            plot(arcPoint(A, q), f > 0.8 ? "+" : "·", 0.25 + 0.5 * f, f > 0.55 ? 3 : 0);
          }
          if (A.p < 1) plot(arcPoint(A, head), "@", 1, 2);
          if (A.p >= 1 && !A.hit) {
            A.hit = true; pulses.push(0);
            if (total < TARGET) { total = Math.min(TARGET, total + Math.round(900 + Math.random() * 1500)); if (self.onHit) self.onHit(total, TARGET); }
          }
          if (A.p > 1.45) arcs.splice(i, 1);
        }
        // impact rings on the honeypot
        var Dq = view(DST);
        if (Dq[2] > 0) {
          var dc = (g.W / 2 + Dq[0] * u - g.ox) / g.cw - 0.5, dr = (g.H / 2 - Dq[1] * u - g.oy) / g.lh - 0.5;
          g.put(dc, dr, "#", 1, 2);
          for (var p = pulses.length - 1; p >= 0; p--) {
            pulses[p] += dt; var R = pulses[p] * 26;
            if (pulses[p] > 0.7) { pulses.splice(p, 1); continue; }
            for (var an = 0; an < 6.283; an += 0.35) g.put(dc + Math.cos(an) * R / g.cw, dr + Math.sin(an) * R / g.lh, "o", 1, 1);
          }
        } else pulses.length = 0;
      }
    };
    return self;
  }

  // ---------- registry + loop ----------
  var grids = [];
  function make(canvas) {
    var name = canvas.getAttribute("data-scene"), size = canvas.getAttribute("data-size");
    var font = size === "lg" ? function (w) { return w < 520 ? 7.5 : 9.5; } : size === "sm" ? 7.5 : function (w) { return w < 520 ? 8 : 9.5; };
    var scene = name === "globe" ? globeScene({ onHit: canvas.__onHit }) : name === "net" ? netScene() : solidScene(name, { spin: size === "sm" ? 0.5 : 0.4, tilt: name === "torus" ? 0.95 : 0.45 });
    var g = new Grid(canvas, scene, font);
    g.t = hash(grids.length + 7) * 20;
    grids.push(g); canvas.__grid = g;
    return g;
  }

  function init() {
    document.querySelectorAll("canvas[data-scene]").forEach(make);
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { var g = e.target.__grid; if (g) g.running = e.isIntersecting; });
    }, { rootMargin: "80px" });
    grids.forEach(function (g) { io.observe(g.c); });
    var ro = new ResizeObserver(function (es) { es.forEach(function (e) { var g = e.target.__grid; if (g) { g.resize(); if (REDUCED) g.frame(0); } }); });
    grids.forEach(function (g) { ro.observe(g.c); });

    if (REDUCED) { grids.forEach(function (g) { g.age = 9; g.frame(0); }); return; }
    var prev = performance.now();
    (function loop(now) {
      var dt = Math.min(0.05, (now - prev) / 1000);
      if (now - prev >= 30) {                     // ~33 fps is plenty for ASCII
        prev = now;
        if (!document.hidden) grids.forEach(function (g) { if (g.running) g.frame(dt); });
      }
      requestAnimationFrame(loop);
    })(prev);
  }

  window.ASCII = { init: function () {
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(init); else init();
  } };
})();
