/* The figure behind the slides: one cloud of points that re-forms into a new shape for every topic.
   Plain script (no modules), so the page also works when opened straight from disk. Needs vendor/three/three.min.js. */
(function () {
  "use strict";

  const TAU = Math.PI * 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // Small seeded generator: every visit shows exactly the same figures.
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------------- Samplers: one random point on a primitive ---------------- */
  const onSphere = (r, c, R) => {
    const u = r() * 2 - 1;
    const a = r() * TAU;
    const s = Math.sqrt(1 - u * u);
    return [c[0] + R * s * Math.cos(a), c[1] + R * u, c[2] + R * s * Math.sin(a)];
  };
  const jit = (r, j) => (r() - 0.5) * 2 * j;
  const onSeg = (r, a, b, j) => {
    const t = r();
    return [lerp(a[0], b[0], t) + jit(r, j), lerp(a[1], b[1], t) + jit(r, j), lerp(a[2], b[2], t) + jit(r, j)];
  };
  const onPath = (r, pts, j) => {            // polyline, uniform by length
    let total = 0;
    const len = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const d = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1], pts[i + 1][2] - pts[i][2]);
      len.push(d); total += d;
    }
    let pick = r() * total;
    for (let i = 0; i < len.length; i++) {
      if (pick <= len[i] || i === len.length - 1) return onSeg(r, pts[i], pts[i + 1], j);
      pick -= len[i];
    }
  };
  // Rounded rectangle outline in the xy plane, centred on c (walked clockwise from the top edge)
  const onRoundRect = (r, c, w, h, rad) => {
    const sx = w - 2 * rad;
    const sy = h - 2 * rad;
    const arc = (TAU / 4) * rad;
    let p = r() * (2 * sx + 2 * sy + 4 * arc);
    const corner = (cx, cy, from) => {
      const a = from - (p / arc) * (TAU / 4);
      return [c[0] + cx + rad * Math.cos(a), c[1] + cy + rad * Math.sin(a), c[2]];
    };
    if (p < sx) return [c[0] - sx / 2 + p, c[1] + h / 2, c[2]];
    p -= sx;
    if (p < arc) return corner(sx / 2, sy / 2, TAU / 4);
    p -= arc;
    if (p < sy) return [c[0] + w / 2, c[1] + sy / 2 - p, c[2]];
    p -= sy;
    if (p < arc) return corner(sx / 2, -sy / 2, 0);
    p -= arc;
    if (p < sx) return [c[0] + sx / 2 - p, c[1] - h / 2, c[2]];
    p -= sx;
    if (p < arc) return corner(-sx / 2, -sy / 2, -TAU / 4);
    p -= arc;
    if (p < sy) return [c[0] - w / 2, c[1] - sy / 2 + p, c[2]];
    p -= sy;
    return corner(-sx / 2, sy / 2, TAU / 2);
  };
  // Box: on its 12 edges, or anywhere on its faces
  const onBox = (r, c, sx, sy, sz, edgesOnly) => {
    const h = [sx / 2, sy / 2, sz / 2];
    const p = [jit(r, 1), jit(r, 1), jit(r, 1)];
    const sign = () => (r() < 0.5 ? -1 : 1);
    if (edgesOnly) {
      const free = Math.floor(r() * 3);               // the axis the edge runs along
      for (let k = 0; k < 3; k++) if (k !== free) p[k] = sign();
    } else {
      // pick a face, weighted by its area
      const area = [sy * sz, sx * sz, sx * sy];
      let pick = r() * (area[0] + area[1] + area[2]);
      const fixed = pick < area[0] ? 0 : pick < area[0] + area[1] ? 1 : 2;
      p[fixed] = sign();
    }
    return [c[0] + p[0] * h[0], c[1] + p[1] * h[1], c[2] + p[2] * h[2]];
  };
  const snap = (v, lo, hi, n) => lo + (Math.round(((v - lo) / (hi - lo)) * (n - 1)) / (n - 1)) * (hi - lo);
  const rotY = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]; };
  const rotX = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c]; };
  const rotZ = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]]; };

  /* ---------------- Figures ----------------
     Each figure is a list of components: { w: share of the points, accent: copper instead of ink, at: sampler }.
     Figures live in a box of roughly ±1.35 units. */
  const FIGURES = {
    // AI in everyday life: a connected world
    globe(r) {
      const R = 1.08;
      const cities = [];
      for (let i = 0; i < 9; i++) cities.push(onSphere(r, [0, 0, 0], 1));
      const pairs = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 0], [0, 4], [2, 6]];
      return [
        { w: 0.44, at: () => {
          if (r() < 0.45) {                          // parallels
            const lat = (Math.floor(r() * 7) - 3) * (Math.PI / 9);
            const a = r() * TAU;
            return [R * Math.cos(lat) * Math.cos(a), R * Math.sin(lat), R * Math.cos(lat) * Math.sin(a)];
          }
          const a = (Math.floor(r() * 12) / 12) * TAU; // meridians
          const lat = (r() - 0.5) * Math.PI;
          return [R * Math.cos(lat) * Math.cos(a), R * Math.sin(lat), R * Math.cos(lat) * Math.sin(a)];
        } },
        { w: 0.12, at: () => onSphere(r, [0, 0, 0], R) },
        { w: 0.14, accent: 1, at: () => { const c = cities[Math.floor(r() * cities.length)]; return onSphere(r, [c[0] * R, c[1] * R, c[2] * R], 0.045); } },
        { w: 0.30, at: () => {                       // routes between the cities, lifted off the surface
          const pr = pairs[Math.floor(r() * pairs.length)];
          const a = cities[pr[0]], b = cities[pr[1]];
          const t = r();
          const p = [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
          const l = Math.hypot(p[0], p[1], p[2]) || 1;
          const k = (R * (1 + 0.24 * Math.sin(Math.PI * t))) / l;
          return [p[0] * k, p[1] * k, p[2] * k];
        } },
      ];
    },

    // What is AI: a small neural network, its layers standing as rings one behind the other
    network(r) {
      const xs = [-1.25, -0.42, 0.42, 1.25];
      const counts = [4, 6, 6, 3];
      const radius = [0.6, 0.92, 0.92, 0.5];
      const layers = xs.map((x, l) => {
        const out = [];
        for (let i = 0; i < counts[l]; i++) {
          const a = (i / counts[l]) * TAU + l * 0.5;
          out.push([x, radius[l] * Math.cos(a), radius[l] * Math.sin(a)]);
        }
        return out;
      });
      const nodes = [].concat.apply([], layers);
      return [
        { w: 0.27, at: () => onSphere(r, nodes[Math.floor(r() * (nodes.length - 3))], 0.085) },
        { w: 0.09, accent: 1, at: () => onSphere(r, layers[3][Math.floor(r() * 3)], 0.095) },
        { w: 0.64, at: () => {
          const l = Math.floor(r() * 3);
          const a = layers[l][Math.floor(r() * layers[l].length)];
          const b = layers[l + 1][Math.floor(r() * layers[l + 1].length)];
          return onSeg(r, a, b, 0.004);
        } },
      ];
    },

    // History: a rising spiral with six milestones
    helix(r) {
      const path = (t, phase) => {
        const a = t * TAU * 2.4 + 0.4 + (phase || 0);
        return [0.64 * Math.cos(a), -1.2 + 2.4 * t, 0.64 * Math.sin(a)];
      };
      const stones = [0, 1, 2, 3, 4, 5].map((k) => (k + 0.5) / 6);
      return [
        { w: 0.40, at: () => { const p = path(r()); return [p[0] + jit(r, 0.012), p[1] + jit(r, 0.012), p[2] + jit(r, 0.012)]; } },
        { w: 0.14, at: () => path(r(), Math.PI) },
        { w: 0.08, at: () => onSeg(r, [0, -1.3, 0], [0, 1.3, 0], 0.006) },
        { w: 0.26, accent: 1, at: () => onSphere(r, path(stones[Math.floor(r() * 6)]), 0.1) },
        { w: 0.12, at: () => { const p = path(stones[Math.floor(r() * 6)]); return onSeg(r, p, [0, p[1], 0], 0.004); } },
      ];
    },

    // Everyday examples: a phone and the apps around it
    phone(r) {
      const tiles = [[-1.02, 0.72, 0.5], [-1.2, -0.08, 0.2], [-0.95, -0.82, 0.62], [1.02, 0.78, 0.3], [1.2, -0.02, 0.62], [0.96, -0.86, 0.26]];
      const turn = (p) => rotX(rotY(p, -0.38), 0.07);
      return [
        { w: 0.24, at: () => turn(onRoundRect(r, [0, 0, r() < 0.5 ? 0.05 : -0.05], 0.98, 1.96, 0.17)) },
        { w: 0.15, at: () => turn([snap(jit(r, 0.38), -0.38, 0.38, 8), snap(jit(r, 0.8), -0.8, 0.8, 16), 0.055]) },
        { w: 0.03, at: () => turn(onSeg(r, [-0.12, 0.88, 0.055], [0.12, 0.88, 0.055], 0.008)) },
        { w: 0.38, at: () => { const c = tiles[Math.floor(r() * 4) + (r() < 0.5 ? 0 : 2)]; return turn(onRoundRect(r, c, 0.34, 0.34, 0.08)); } },
        { w: 0.20, accent: 1, at: () => {             // a glyph inside every tile
          const c = tiles[Math.floor(r() * 6)];
          const a = r() * TAU;
          return turn([c[0] + 0.075 * Math.cos(a), c[1] + 0.075 * Math.sin(a), c[2]]);
        } },
      ];
    },

    // Benefits and risks: a balance
    scale(r) {
      const tilt = 0.1;
      const ends = [[-1.0, 0.7 - tilt, 0], [1.0, 0.7 + tilt, 0]];
      const pans = ends.map((e) => [e[0], e[1] - 0.74, 0]);
      const rim = (pan, a) => [pan[0] + 0.4 * Math.cos(a), pan[1], pan[2] + 0.4 * Math.sin(a)];
      const balls = [[-1.13, 0.16, 0.05], [-0.87, 0.16, -0.04], [-1.0, 0.36, 0.02]].map((b) => [b[0], pans[0][1] + b[1] - 0.02, b[2]]);
      return [
        { w: 0.07, at: () => { const a = r() * TAU, R = r() < 0.65 ? 0.46 : 0.26; return [R * Math.cos(a), -1.18, R * Math.sin(a)]; } },
        { w: 0.09, at: () => onSeg(r, [0, -1.18, 0], [0, 0.78, 0], 0.012) },
        { w: 0.10, at: () => onSeg(r, ends[0], ends[1], 0.012) },
        { w: 0.04, accent: 1, at: () => onSphere(r, [0, 0.74, 0], 0.07) },
        { w: 0.11, at: () => { const s = r() < 0.5 ? 0 : 1; return onSeg(r, ends[s], rim(pans[s], (Math.floor(r() * 3) / 3) * TAU + 0.5), 0.003); } },
        { w: 0.24, at: () => {
          const pan = pans[r() < 0.5 ? 0 : 1];
          const a = r() * TAU;
          const R = r() < 0.55 ? 0.4 : 0.4 * Math.sqrt(r());
          return [pan[0] + R * Math.cos(a), pan[1], pan[2] + R * Math.sin(a)];
        } },
        { w: 0.18, accent: 1, at: () => onSphere(r, balls[Math.floor(r() * 3)], 0.135) },
        { w: 0.17, at: () => onBox(r, [pans[1][0], pans[1][1] + 0.17, 0], 0.32, 0.32, 0.32, r() < 0.6) },
      ];
    },

    // Tools and use cases: a core with everything in orbit around it
    orbit(r) {
      const rings = [{ R: 0.82, x: 1.15, z: 0.25 }, { R: 1.04, x: 1.45, z: -0.55 }, { R: 1.26, x: 1.3, z: 0.95 }];
      const onRing = (k, a) => { const g = rings[k]; return rotZ(rotX([g.R * Math.cos(a), 0, g.R * Math.sin(a)], g.x), g.z); };
      const sats = [[0, 0.4], [0, 3.4], [1, 1.2], [1, 4.3], [2, 2.2], [2, 5.5]];
      return [
        { w: 0.22, at: () => onSphere(r, [0, 0, 0], r() < 0.7 ? 0.34 : 0.2) },
        { w: 0.06, accent: 1, at: () => onSphere(r, [0, 0, 0], 0.1) },
        { w: 0.46, at: () => { const p = onRing(Math.floor(r() * 3), r() * TAU); return [p[0] + jit(r, 0.008), p[1] + jit(r, 0.008), p[2] + jit(r, 0.008)]; } },
        { w: 0.17, accent: 1, at: () => { const s = sats[Math.floor(r() * 6)]; return onSphere(r, onRing(s[0], s[1]), 0.075); } },
        { w: 0.09, at: () => onSphere(r, [0, 0, 0], 1.42 + r() * 0.2) },
      ];
    },

    // How LLMs work: tokens in, layers of attention, probabilities out
    transformer(r) {
      const xs = [0, 1, 2, 3, 4, 5].map((i) => -1.0 + i * 0.4);
      const ys = [-0.5, -0.06, 0.38];
      const heights = [0.2, 0.3, 0.66, 0.24, 0.15, 0.2];
      return [
        { w: 0.19, at: () => onBox(r, [xs[Math.floor(r() * 6)], -1.14, 0], 0.2, 0.2, 0.2, true) },
        { w: 0.11, at: () => { const x = xs[Math.floor(r() * 6)]; return onSeg(r, [x, -1.03, 0], [x, 0.74, 0], 0.003); } },
        { w: 0.40, at: () => {
          const y = ys[Math.floor(r() * 3)];
          if (r() < 0.42) {                          // outline of the layer
            const along = r() < 0.74;
            return along ? [jit(r, 1.22), y, r() < 0.5 ? -0.42 : 0.42] : [r() < 0.5 ? -1.22 : 1.22, y, jit(r, 0.42)];
          }
          return [snap(jit(r, 1.22), -1.22, 1.22, 13), y, snap(jit(r, 0.42), -0.42, 0.42, 5)];
        } },
        { w: 0.18, at: () => { const i = [0, 1, 3, 4, 5][Math.floor(r() * 5)]; return onBox(r, [xs[i], 0.76 + heights[i] / 2, 0], 0.17, heights[i], 0.17, r() < 0.5); } },
        { w: 0.12, accent: 1, at: () => onBox(r, [xs[2], 0.76 + heights[2] / 2, 0], 0.17, heights[2], 0.17, r() < 0.4) },
      ];
    },

    // Basic vs. technical prompts: a vague cloud next to an ordered structure
    compare(r) {
      const g = () => (r() + r() + r() - 1.5) * 0.52;
      const side = 0.96;
      const n = 4;
      const node = (i, j, k) => [0.8 - side / 2 + (i / (n - 1)) * side, -side / 2 + (j / (n - 1)) * side, -side / 2 + (k / (n - 1)) * side];
      const any = () => Math.floor(r() * n);
      return [
        { w: 0.40, at: () => [-0.82 + g(), g(), g()] },
        { w: 0.30, at: () => onSphere(r, node(any(), any(), any()), 0.034) },
        { w: 0.08, accent: 1, at: () => onSphere(r, node(r() < 0.5 ? 0 : n - 1, r() < 0.5 ? 0 : n - 1, r() < 0.5 ? 0 : n - 1), 0.05) },
        { w: 0.22, at: () => {
          const axis = Math.floor(r() * 3);
          const a = [any(), any(), any()], b = a.slice();
          a[axis] = 0; b[axis] = n - 1;
          return onSeg(r, node(a[0], a[1], a[2]), node(b[0], b[1], b[2]), 0.003);
        } },
      ];
    },

    // Token efficiency: the same job in fewer and fewer tokens
    bars(r) {
      const heights = [0, 1, 2, 3, 4, 5, 6].map((i) => 1.95 * Math.pow(0.72, i));
      const total = heights.reduce((a, b) => a + b, 0);
      const pick = () => { let p = r() * total; for (let i = 0; i < 7; i++) { if (p <= heights[i]) return i; p -= heights[i]; } return 6; };
      const bar = (i) => onBox(r, [-1.08 + i * 0.36, -1.05 + heights[i] / 2, 0], 0.2, heights[i], 0.2, r() < 0.5);
      return [
        { w: 0.70, at: () => bar(Math.min(5, pick())) },
        { w: 0.10, accent: 1, at: () => bar(6) },
        { w: 0.20, at: () => [snap(jit(r, 1.4), -1.4, 1.4, 21), -1.06, snap(jit(r, 0.5), -0.5, 0.5, 7)] },
      ];
    },

    // Using AI responsibly: a shield
    shield(r) {
      const half = (y) => (y >= 0.25 ? 0.82 : 0.82 * Math.pow(Math.cos(((0.25 - y) / 1.45) * (Math.PI / 2)), 0.75));
      const ring = (a) => rotZ(rotX([1.38 * Math.cos(a), 0, 1.38 * Math.sin(a)], 1.25), 0.3);
      return [
        { w: 0.36, at: () => {
          const z = r() < 0.5 ? 0.07 : -0.07;
          if (r() < 0.2) return [jit(r, 0.82), 0.98, z];
          const y = -1.2 + Math.pow(r(), 0.8) * 2.18;
          return [(r() < 0.5 ? -1 : 1) * half(y), y, z];
        } },
        { w: 0.20, at: () => {
          const y = snap(-1.1 + r() * 2.0, -1.1, 0.9, 19);
          const w = Math.max(0, half(y) - 0.08);
          const x = Math.round((jit(r, 1) * w) / 0.105) * 0.105;
          return [x, y, 0];
        } },
        { w: 0.22, accent: 1, at: () => onPath(r, [[-0.36, 0.0, 0.1], [-0.1, -0.3, 0.1], [0.42, 0.36, 0.1]], 0.028) },
        { w: 0.14, at: () => ring(r() * TAU) },
        { w: 0.08, at: () => onSphere(r, [0, 0, 0], 1.45 + r() * 0.15) },
      ];
    },

    // Key takeaways: what is left when everything is boiled down
    gem(r) {
      const phi = (1 + Math.sqrt(5)) / 2;
      const raw = [];
      [-1, 1].forEach((a) => [-1, 1].forEach((b) => { raw.push([0, a, b * phi]); raw.push([a, b * phi, 0]); raw.push([a * phi, 0, b]); }));
      const norm = Math.hypot(1, phi);
      const verts = raw.map((v) => rotZ(rotX([v[0] / norm, v[1] / norm, v[2] / norm], 0.55), 0.3));
      const edges = [];
      for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) {
        if (Math.hypot(verts[i][0] - verts[j][0], verts[i][1] - verts[j][1], verts[i][2] - verts[j][2]) < 1.1) edges.push([i, j]);
      }
      const scaled = (v, k) => [v[0] * k, v[1] * k, v[2] * k];
      return [
        { w: 0.50, at: () => { const e = edges[Math.floor(r() * edges.length)]; return onSeg(r, scaled(verts[e[0]], 1.14), scaled(verts[e[1]], 1.14), 0.006); } },
        { w: 0.16, accent: 1, at: () => onSphere(r, scaled(verts[Math.floor(r() * 12)], 1.14), 0.06) },
        { w: 0.22, at: () => { const e = edges[Math.floor(r() * edges.length)]; return onSeg(r, scaled(verts[e[0]], 0.52), scaled(verts[e[1]], 0.52), 0.004); } },
        { w: 0.12, accent: 1, at: () => onSphere(r, [0, 0, 0], 0.13 * Math.cbrt(r())) },
      ];
    },
  };
  const SPIN = { globe: 1, network: 1, helix: 1, orbit: 1, gem: 1 };   // these keep turning; the others sway from side to side

  // Fill n points (x, y, z, accent) from a figure's components, then shuffle so every flight path is different.
  function build(name, n, seed) {
    const r = rng(seed);
    const comps = FIGURES[name](r);
    const total = comps.reduce((a, c) => a + c.w, 0);
    const out = new Float32Array(n * 4);
    let i = 0;
    comps.forEach((c, k) => {
      const count = k === comps.length - 1 ? n - i : Math.min(n - i, Math.round((n * c.w) / total));
      for (let j = 0; j < count; j++, i++) {
        const p = c.at();
        out[i * 4] = p[0]; out[i * 4 + 1] = p[1]; out[i * 4 + 2] = p[2]; out[i * 4 + 3] = c.accent ? 1 : 0;
      }
    });
    for (let a = n - 1; a > 0; a--) {
      const b = Math.floor(r() * (a + 1));
      for (let k = 0; k < 4; k++) { const t = out[a * 4 + k]; out[a * 4 + k] = out[b * 4 + k]; out[b * 4 + k] = t; }
    }
    return out;
  }

  const VERT = [
    "attribute vec4 aFrom;",
    "attribute vec4 aTo;",
    "attribute vec4 aSeed;",
    "uniform float uMix;",
    "uniform float uGather;",
    "uniform float uTime;",
    "uniform float uSize;",
    "uniform float uPx;",
    "uniform float uMinPx;",
    "uniform vec2 uDepth;",
    "varying float vAccent;",
    "varying float vAlpha;",
    "void main() {",
    "  float t = clamp(uMix * 1.4 - aSeed.x * 0.4, 0.0, 1.0);",        // every point leaves at its own moment
    "  t = t * t * (3.0 - 2.0 * t);",
    "  vec3 p = mix(aFrom.xyz, aTo.xyz, t);",
    "  float arc = sin(t * 3.14159265);",
    "  vec3 dir = normalize(aSeed.yzw - 0.5 + 0.0001);",
    "  p += dir * arc * 0.5;",                                          // on the way: out of line, and around the axis
    "  float a = arc * (aSeed.y - 0.5) * 2.4;",
    "  float c = cos(a);",
    "  float s = sin(a);",
    "  p.xz = mat2(c, -s, s, c) * p.xz;",
    "  p += 0.011 * vec3(sin(uTime * 0.9 + aSeed.x * 40.0), cos(uTime * 0.7 + aSeed.y * 40.0), sin(uTime * 0.8 + aSeed.z * 40.0));",
    "  float g = clamp(uGather * 1.35 - aSeed.w * 0.35, 0.0, 1.0);",    // arriving from a scattered cloud
    "  g = g * g * (3.0 - 2.0 * g);",
    "  p = mix(dir * (2.4 + aSeed.x * 2.4), p, g);",
    "  vec4 mv = modelViewMatrix * vec4(p, 1.0);",
    "  gl_Position = projectionMatrix * mv;",
    "  float accent = mix(aFrom.w, aTo.w, t);",
    "  vAccent = accent;",
    "  float size = uSize * (0.7 + aSeed.z * 0.75) * (1.0 + accent * 0.45);",
    "  gl_PointSize = max(uMinPx, size * uPx / -mv.z);",
    "  float depth = smoothstep(uDepth.x, uDepth.y, -mv.z);",
    "  vAlpha = mix(1.0, 0.3, depth) * g * (1.0 - 0.3 * arc);",
    "}",
  ].join("\n");

  const FRAG = [
    "uniform vec3 uInk;",
    "uniform vec3 uAccent;",
    "varying float vAccent;",
    "varying float vAlpha;",
    "void main() {",
    "  float d = length(gl_PointCoord - 0.5);",
    "  float a = smoothstep(0.5, 0.3, d) * vAlpha * 0.92;",
    "  if (a < 0.01) discard;",
    "  gl_FragColor = vec4(mix(uInk, uAccent, vAccent), a);",
    "  #include <colorspace_fragment>",
    "}",
  ].join("\n");

  /* create(canvas, { figures: [names…], count }) → controller, or null when WebGL is not available */
  function create(canvas, options) {
    const T = window.THREE;
    if (!T) return null;
    let renderer;
    try {
      renderer = new T.WebGLRenderer({ canvas: canvas, alpha: true, antialias: false, powerPreference: "high-performance" });
    } catch (e) { return null; }
    renderer.setClearColor(0x000000, 0);

    const names = options.figures;
    const n = options.count;
    const sets = names.map((name, i) => build(name, n, 1000 + i * 77));

    const seeds = new Float32Array(n * 4);
    const sr = rng(4242);
    for (let i = 0; i < n * 4; i++) seeds[i] = sr();

    const geometry = new T.BufferGeometry();
    const from = new T.BufferAttribute(new Float32Array(n * 4), 4);
    const to = new T.BufferAttribute(new Float32Array(n * 4), 4);
    from.setUsage(T.DynamicDrawUsage);
    to.setUsage(T.DynamicDrawUsage);
    geometry.setAttribute("position", new T.BufferAttribute(new Float32Array(n * 3), 3));   // unused, but expected
    geometry.setAttribute("aFrom", from);
    geometry.setAttribute("aTo", to);
    geometry.setAttribute("aSeed", new T.BufferAttribute(seeds, 4));

    const FOV = 30;
    const DIST = 7.5;
    const material = new T.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: T.NormalBlending,
      uniforms: {
        uMix: { value: 0 }, uGather: { value: 0 }, uTime: { value: 0 },
        uSize: { value: 0.0175 }, uPx: { value: 1 }, uMinPx: { value: 1 },
        uDepth: { value: new T.Vector2(DIST - 1.4, DIST + 1.6) },
        uInk: { value: new T.Color(0x161c1f) }, uAccent: { value: new T.Color(0xb4602c) },
      },
    });
    const points = new T.Points(geometry, material);
    points.frustumCulled = false;
    const group = new T.Group();
    group.add(points);
    const scene = new T.Scene();
    scene.add(group);
    const camera = new T.PerspectiveCamera(FOV, 1, 0.1, 50);
    camera.position.set(0, 0, DIST);

    let width = 0, height = 0, pair = -1;
    let spin = 0;          // 0…1: how much the current figure turns on its own
    let wasSpinning = false;
    let angle = 0;
    let last = 0;
    let twist = 0;         // extra full turns, one for every step sideways inside a slide
    const SIZE = 0.0145;   // diameter of a point, in figure units
    let box = { x: 0.5, y: 0.5, w: 0.5, h: 0.7 };
    const look = { x: 0, y: 0 };

    function layout() {
      if (!width) return;
      const visH = 2 * DIST * Math.tan((FOV * Math.PI) / 360);
      const visW = visH * (width / height);
      const k = Math.min(box.w * visW, box.h * visH) / 2.9;      // a figure spans about 2.9 units
      group.scale.setScalar(k);
      group.position.set((box.x - 0.5) * visW, (0.5 - box.y) * visH, 0);
      material.uniforms.uSize.value = SIZE * k;
    }

    const api = {
      // Size of the canvas in CSS pixels
      resize(w, h, dpr) {
        if (!w || !h) return;
        width = w; height = h;
        renderer.setPixelRatio(dpr);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        material.uniforms.uPx.value = (h * dpr) / (2 * Math.tan((FOV * Math.PI) / 360));
        material.uniforms.uMinPx.value = 1.15 * dpr;
        layout();
      },
      // Where the figure sits: centre (x, y) and largest size (w, h), as fractions of the canvas
      place(b) { box = b; layout(); },
      // 0 = scattered, 1 = formed
      gather(g) { material.uniforms.uGather.value = g; },
      // Position in the deck: 2.0 is exactly the third figure, 2.5 is half-way to the fourth
      progress(pos) {
        const i = clamp(Math.floor(pos), 0, Math.max(0, names.length - 2));
        if (i !== pair) {
          pair = i;
          from.array.set(sets[i]);
          to.array.set(sets[Math.min(names.length - 1, i + 1)]);
          from.needsUpdate = true;
          to.needsUpdate = true;
        }
        const local = clamp(pos - i, 0, 1);
        const m = clamp((local - 0.18) / 0.72, 0, 1);            // the change happens between the stops, not on them
        material.uniforms.uMix.value = m;
        const eased = m * m * (3 - 2 * m);
        spin = lerp(SPIN[names[i]] ? 1 : 0, SPIN[names[Math.min(names.length - 1, i + 1)]] ? 1 : 0, eased);
      },
      // Extra turns around the vertical axis: 1 is one full turn
      twist(v) { twist = v; },
      // time in seconds; pointer in -1…1 on both axes
      render(time, pointer) {
        if (!width) return;
        look.x += ((pointer ? pointer.x : 0) - look.x) * 0.05;
        look.y += ((pointer ? pointer.y : 0) - look.y) * 0.05;
        // Round figures keep turning; when one gives way to a figure that faces the viewer, the turn unwinds with the change.
        const dt = Math.min(0.1, Math.max(0, time - last));
        last = time;
        if (spin > 0.999) { angle += dt * 0.2; wasSpinning = true; }
        else if (spin < 0.001) { angle = 0; wasSpinning = false; }
        else if (wasSpinning) { angle = ((((angle + Math.PI) % TAU) + TAU) % TAU) - Math.PI; wasSpinning = false; }
        // Swaying figures move about as fast as the turning ones, so no slide feels slower than the one before.
        group.rotation.y = Math.sin(time * 0.42) * 0.52 * (1 - spin) + angle * spin + twist * TAU + look.x * 0.28;
        group.rotation.x = 0.1 + Math.sin(time * 0.23) * 0.05 + look.y * 0.14;
        material.uniforms.uTime.value = time;
        renderer.render(scene, camera);
      },
      dispose() { geometry.dispose(); material.dispose(); renderer.dispose(); },
    };
    api.progress(0);
    return api;
  }

  window.Figures = { create: create, names: Object.keys(FIGURES) };
})();
