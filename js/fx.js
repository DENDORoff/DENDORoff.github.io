/* ============================================================
   DENDOR bio — interaction layer
   Inertia scroll, idle auto-scroll, particles, custom cursor,
   compact/expand cards, FX dropdown. All toggles are persisted.
   ============================================================ */
(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(pointer: fine)").matches;
  const PREFIX = "bio:fx:";

  function getOpt(name, def) {
    try {
      const v = localStorage.getItem(PREFIX + name);
      return v === null ? def : v === "1";
    } catch (e) { return def; }
  }
  function setOpt(name, val) {
    try { localStorage.setItem(PREFIX + name, val ? "1" : "0"); } catch (e) { /* private mode */ }
  }

  const opts = {
    inertia: getOpt("inertia", !reduced),
    auto: getOpt("auto", !reduced),
    particles: getOpt("particles", !reduced && fine),
    music: getOpt("music", !reduced),
  };
  const body = document.body;
  const pcanvas = $("#fx-particles");
  const scanvas = $("#fx-sparks");
  const cursor = $("#fx-cursor");

  function applyOpts() {
    Object.keys(opts).forEach((k) => body.classList.toggle("fx-flag-" + k, opts[k]));
    body.classList.toggle("fx-no-native-cursor", opts.particles && fine);
    if (pcanvas) pcanvas.hidden = !opts.particles;
    if (scanvas) scanvas.hidden = !opts.particles;
    if (cursor && !opts.particles) cursor.classList.remove("on");
    $$("[data-fx]").forEach((input) => { input.checked = opts[input.dataset.fx]; });
  }
  applyOpts();

  /* ---------- FX dropdown (>2 options → dropdown, swipe/Esc/outside to close) ---------- */

  const menu = $("#fx-menu");
  const trigger = $("#fx-trigger");
  const panel = $("#fx-panel");

  function togglePanel(show) {
    if (!panel || !trigger) return;
    panel.hidden = !show;
    trigger.setAttribute("aria-expanded", show ? "true" : "false");
  }

  if (trigger) {
    trigger.addEventListener("click", (ev) => {
      ev.stopPropagation();
      togglePanel(panel.hidden);
    });
  }
  document.addEventListener("click", (ev) => {
    if (panel && !panel.hidden && menu && !menu.contains(ev.target)) togglePanel(false);
  });
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") togglePanel(false); });

  if (panel) {
    let startY = 0;
    panel.addEventListener("touchstart", (e) => { startY = e.touches[0].clientY; }, { passive: true });
    panel.addEventListener("touchmove", (e) => {
      if (e.touches[0].clientY - startY > 40) togglePanel(false);
    }, { passive: true });
  }

  $$("[data-fx]").forEach((input) => {
    input.addEventListener("change", () => {
      opts[input.dataset.fx] = input.checked;
      setOpt(input.dataset.fx, input.checked);
      applyOpts();
      wake();
    });
  });

  /* ---------- compact cards: expand in viewport ---------- */

  const cards = $$(".card");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => e.target.classList.toggle("in-view", e.isIntersecting));
    }, { threshold: 0.2 });
    cards.forEach((c) => io.observe(c));
  } else {
    cards.forEach((c) => c.classList.add("in-view"));
  }

  /* ---------- smooth anchors (CSS scroll-behavior is auto) ---------- */

  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (ev) => {
      const id = a.getAttribute("href").slice(1);
      const target = document.getElementById(id);
      if (!target) return;
      ev.preventDefault();
      target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      try { history.replaceState(null, "", "#" + id); } catch (e) { /* file:// */ }
      vel = 0;
      wake();
    });
  });

  /* ---------- canvases ---------- */

  let pctx = null, sctx = null;
  let pw = 0, ph = 0, dpr = 1;
  let dots = [], sparks = [];

  function resizeCanvas(c, ctx) {
    c.width = Math.round(pw * dpr);
    c.height = Math.round(ph * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seedDots() {
    const n = Math.min(26, Math.max(10, Math.round(pw / 60)));
    dots = [];
    for (let i = 0; i < n; i++) {
      dots.push({
        x: Math.random() * pw,
        y: Math.random() * ph,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.18,
        r: 0.8 + Math.random() * 1.3,
        cyan: Math.random() > 0.72,
      });
    }
  }

  function resize() {
    pw = innerWidth;
    ph = innerHeight;
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    if (pcanvas && pctx) resizeCanvas(pcanvas, pctx);
    if (scanvas && sctx) resizeCanvas(scanvas, sctx);
    if (!dots.length) seedDots();
  }

  if (pcanvas) pctx = pcanvas.getContext("2d");
  if (scanvas) sctx = scanvas.getContext("2d");
  if (pctx || sctx) {
    resize();
    addEventListener("resize", resize);
  }

  /* ---------- pointer: cursor ring + sparks ---------- */

  let mx = -100, my = -100, cx = -100, cy = -100, lastSpark = 0;

  addEventListener("pointermove", (ev) => {
    if (!fine) return;
    mx = ev.clientX;
    my = ev.clientY;
    if (cursor && opts.particles) cursor.classList.add("on");
    if (cursor) {
      const el = ev.target;
      const hot = el && el.closest && el.closest("a, button, input, label, .pl-item, .fx-row");
      cursor.classList.toggle("hot", !!hot);
    }
    const now = performance.now();
    if (opts.particles && sparks.length < 28 && now - lastSpark > 26) {
      lastSpark = now;
      sparks.push({
        x: mx, y: my,
        vx: (Math.random() - 0.5) * 1.4,
        vy: (Math.random() - 0.5) * 1.4 - 0.35,
        life: 1,
        cyan: Math.random() > 0.65,
      });
    }
    wake();
  }, { passive: true });

  document.addEventListener("pointerleave", () => {
    if (cursor) cursor.classList.remove("on");
  });

  /* ---------- scroll: inertia + idle auto-scroll ---------- */

  let vel = 0;
  let idleAt = performance.now();

  function wake() { idleAt = performance.now(); }
  ["pointerdown", "touchstart", "touchmove", "keydown"].forEach((ev) => {
    addEventListener(ev, wake, { passive: true });
  });

  function maxScroll() {
    return Math.max(0, document.documentElement.scrollHeight - innerHeight);
  }

  addEventListener("wheel", (ev) => {
    wake();
    if (!opts.inertia || !fine || ev.ctrlKey) return;
    const el = ev.target;
    if (el && el.closest && el.closest(".nav, .pl-list, .fx-panel, [data-native-scroll]")) return;
    ev.preventDefault();
    const d = ev.deltaMode === 1 ? ev.deltaY * 16
      : ev.deltaMode === 2 ? ev.deltaY * innerHeight
      : ev.deltaY;
    vel = Math.max(-55, Math.min(55, vel + d * 0.16));
  }, { passive: false });

  /* ---------- one animation loop for everything ---------- */

  function drawDots(pulse) {
    if (!pctx || !opts.particles) return;
    pctx.clearRect(0, 0, pw, ph);
    const boost = opts.music ? 1 + pulse * 0.55 : 1;
    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      d.x += d.vx;
      d.y += d.vy;
      if (d.x < -10) d.x = pw + 10;
      if (d.x > pw + 10) d.x = -10;
      if (d.y < -10) d.y = ph + 10;
      if (d.y > ph + 10) d.y = -10;

      pctx.beginPath();
      pctx.arc(d.x, d.y, d.r * boost, 0, Math.PI * 2);
      pctx.fillStyle = d.cyan
        ? "rgba(0,229,255," + (0.10 + 0.10 * pulse) + ")"
        : "rgba(57,255,136," + (0.10 + 0.10 * pulse) + ")";
      pctx.fill();

      for (let j = i + 1; j < dots.length; j++) {
        const o = dots[j];
        const dx = d.x - o.x, dy = d.y - o.y;
        if (Math.abs(dx) > 110 || Math.abs(dy) > 110) continue;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 110) continue;
        pctx.beginPath();
        pctx.moveTo(d.x, d.y);
        pctx.lineTo(o.x, o.y);
        pctx.strokeStyle = "rgba(57,255,136," + (0.045 * (1 - dist / 110)) + ")";
        pctx.lineWidth = 0.6;
        pctx.stroke();
      }
    }
  }

  function drawSparks() {
    if (!sctx || !opts.particles) return;
    sctx.clearRect(0, 0, pw, ph);
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.012;
      s.life -= 0.028;
      if (s.life <= 0) { sparks.splice(i, 1); continue; }
      sctx.beginPath();
      sctx.arc(s.x, s.y, 1.6 * s.life + 0.4, 0, Math.PI * 2);
      sctx.fillStyle = s.cyan
        ? "rgba(0,229,255," + (s.life * 0.75) + ")"
        : "rgba(180,255,215," + (s.life * 0.85) + ")";
      sctx.fill();
    }
  }

  function loop(now) {
    requestAnimationFrame(loop);
    if (document.hidden) return;

    /* scroll physics */
    const idle = now - idleAt > 4000;
    if (opts.inertia && Math.abs(vel) > 0.15) {
      const next = Math.max(0, Math.min(maxScroll(), window.scrollY + vel));
      window.scrollTo(0, next);
      if (next <= 0 || next >= maxScroll() - 1) vel = 0;
      vel *= 0.93;
    } else if (opts.auto && idle && window.scrollY < maxScroll() - 2) {
      window.scrollTo(0, Math.min(maxScroll(), window.scrollY + 0.55));
    }

    const pulse = opts.music ? ((window.MUSIC && window.MUSIC.pulse) || 0) : 0;

    /* cursor ring lags slightly behind the pointer */
    if (fine && opts.particles && cursor) {
      cx += (mx - cx) * 0.24;
      cy += (my - cy) * 0.24;
      cursor.style.transform =
        "translate3d(" + cx.toFixed(1) + "px," + cy.toFixed(1) + "px,0) translate(-50%,-50%)";
    }

    drawDots(pulse);
    drawSparks();
  }

  requestAnimationFrame(loop);
  wake();
})();
