/* ============================================================
   DENDOR bio — widgets & animations
   ============================================================ */
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));

  /* скелетон → данные */
  const ready = (el) => { if (el) el.classList.remove("skel"); };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function getJSON(url, { headers = {}, timeout = 12000, method = "GET", body } = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, { method, headers, body, signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function getText(url, { headers = {}, timeout = 15000 } = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, { headers, signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } finally {
      clearTimeout(timer);
    }
  }

  /* ---------- localStorage cache ---------- */
  const cache = {
    get(key, ttlMin) {
      try {
        const raw = localStorage.getItem("bio:" + key);
        if (!raw) return null;
        const { t, v } = JSON.parse(raw);
        return Date.now() - t < ttlMin * 60000 ? v : null;
      } catch (e) { return null; }
    },
    set(key, v) {
      try { localStorage.setItem("bio:" + key, JSON.stringify({ t: Date.now(), v })); }
      catch (e) { /* private mode */ }
    },
  };

  /* ============================================================
     BOOT SEQUENCE
     ============================================================ */
  async function boot() {
    const el = $("#boot");
    const out = $("#boot-out");
    if (!el) return startHero();

    const finish = () => {
      el.classList.add("done");
      document.body.classList.remove("booting");
      setTimeout(() => el.remove(), 650);
      startHero();
    };

    let seen = false;
    try { seen = sessionStorage.getItem("bio:booted"); } catch (e) { /* no storage */ }
    if (reduced || seen) { el.remove(); document.body.classList.remove("booting"); return startHero(); }
    try { sessionStorage.setItem("bio:booted", "1"); } catch (e) { /* no storage */ }
    document.body.classList.add("booting");

    let skip = false;
    const onSkip = () => { skip = true; };
    ["keydown", "pointerdown", "wheel"].forEach((ev) => addEventListener(ev, onSkip, { once: true, passive: true }));

    for (const line of CONFIG.bootLines) {
      if (skip) { out.textContent += line + "\n"; continue; }
      let i = 0;
      for (; i < line.length; i++) {
        if (skip) break;
        out.textContent += line[i];
        await sleep(line[i] === "." ? 6 : 4);
      }
      if (skip) out.textContent += line.slice(i);
      out.textContent += "\n";
      if (!skip) await sleep(80);
    }
    await sleep(skip ? 0 : 450);
    finish();
  }

  /* ============================================================
     MATRIX RAIN
     ============================================================ */
  function matrix() {
    if (reduced) return;
    const c = $("#matrix");
    if (!c) return;
    const ctx = c.getContext("2d");
    const fs = 15;
    const glyphs = "アイウエオカキクケコサシスセソタチツテト0123456789ABCDEF<>/$#*+{}[]";
    let cols = 0, drops = [];

    const resize = () => {
      c.width = innerWidth;
      c.height = innerHeight;
      cols = Math.ceil(c.width / fs);
      drops = Array.from({ length: cols }, () => Math.random() * -60);
    };
    resize();
    addEventListener("resize", resize);

    let last = 0;
    const frame = (ts) => {
      requestAnimationFrame(frame);
      if (document.hidden) return;
      const beat = (window.MUSIC && window.MUSIC.pulse) || 0;
      if (ts - last < 42 - beat * 18) return;
      last = ts;
      ctx.fillStyle = "rgba(5, 6, 8, 0.09)";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.font = fs + "px monospace";
      for (let i = 0; i < cols; i++) {
        const ch = glyphs[(Math.random() * glyphs.length) | 0];
        const x = i * fs, y = drops[i] * fs;
        ctx.fillStyle = Math.random() > 0.985 ? "#b6ffda" : "#39ff88";
        ctx.fillText(ch, x, y);
        if (y > c.height && Math.random() > 0.972) drops[i] = 0;
        drops[i]++;
      }
    };
    requestAnimationFrame(frame);
  }

  /* ============================================================
     HERO TYPEWRITER
     ============================================================ */
  function startHero() {
    $$(".hero .reveal").forEach((n, i) => setTimeout(() => n.classList.add("in"), 90 * i));
    const target = $("#hero-type");
    if (!target) return;
    const lines = CONFIG.heroLines;
    if (reduced) { target.textContent = lines[0]; return; }

    (async () => {
      let i = 0;
      while (true) {
        const text = lines[i % lines.length];
        for (let k = 1; k <= text.length; k++) {
          target.textContent = text.slice(0, k);
          await sleep(42);
        }
        await sleep(1700);
        for (let k = text.length; k >= 0; k--) {
          target.textContent = text.slice(0, k);
          await sleep(22);
        }
        await sleep(320);
        i++;
      }
    })();
  }

  /* ============================================================
     CLOCKS
     ============================================================ */
  function clocks() {
    const TZ = "Asia/Almaty";
    const almaty = new Intl.DateTimeFormat("ru-RU", {
      timeZone: TZ,
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    const timeFmt = new Intl.DateTimeFormat("ru-RU", {
      timeZone: TZ,
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    const partsFmt = new Intl.DateTimeFormat("ru-RU", {
      timeZone: TZ,
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    });
    const tzEl = $("#clk-tz");
    if (tzEl) tzEl.textContent = TZ;

    const tick = () => {
      const now = new Date();
      const t = timeFmt.format(now);
      ["#topclock", "#hero-clock", "#clk-time"].forEach((s) => {
        const el = $(s); if (el) el.textContent = t;
      });
      const d = $("#clk-date"); if (d) d.textContent = almaty.format(now);
      const bar = $("#clk-bar-w");
      if (bar) {
        const p = partsFmt.formatToParts(now);
        const get = (type) => Number((p.find((x) => x.type === type) || {}).value || 0);
        const pct = ((get("hour") * 3600 + get("minute") * 60 + get("second")) / 86400) * 100;
        bar.style.width = pct.toFixed(2) + "%";
      }
    };
    tick();
    setInterval(tick, 1000);

    /* погода — Open-Meteo (JSON, без ключа и CORS-проблем) */
    const weatherEl = $("#clk-weather");
    const city = String((CONFIG.weather && CONFIG.weather.city) || "Pavlodar");
    const coords = city === "Pavlodar" ? { lat: 52.29, lon: 76.96 } : null;
    if (weatherEl && coords) {
      const icon = (code) =>
        code === 0 ? "☀" :
        code <= 2 ? "🌤" :
        code === 3 ? "☁" :
        code <= 48 ? "🌫" :
        code <= 67 ? "🌧" :
        code <= 77 ? "❄" :
        code <= 82 ? "🌦" :
        "⛈";
      (async () => {
        try {
          const j = await getJSON(
            `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}` +
            "&current=temperature_2m,weather_code&timezone=Asia%2FAlmaty",
            { timeout: 9000 }
          );
          const cur = j && j.current;
          if (!cur) return;
          const sign = cur.temperature_2m > 0 ? "+" : "";
          weatherEl.textContent =
            `${sign}${Math.round(cur.temperature_2m)}° ${icon(cur.weather_code)} · ${city}`;
        } catch (e) {
          weatherEl.textContent = "погода недоступна";
        }
      })();
    }
  }

  /* ============================================================
     REVEAL + SECTION TITLE TYPING
     ============================================================ */
  function reveals() {
    if (!("IntersectionObserver" in window)) {
      $$(".reveal").forEach((n) => n.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("in");
        io.unobserve(e.target);
      }
    }, { threshold: 0.12 });
    $$(".reveal").forEach((n) => io.observe(n));

    const tio = new IntersectionObserver(async (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        tio.unobserve(e.target);
        const el = e.target;
        const text = el.dataset.text || "";
        if (reduced) { el.textContent = text; continue; }
        for (let i = 1; i <= text.length; i++) {
          el.textContent = text.slice(0, i);
          await sleep(26);
        }
      }
    }, { threshold: 0.4 });
    $$(".sec-title").forEach((n) => tio.observe(n));
  }

  /* ============================================================
     STATIC CONTENT
     ============================================================ */
  function renderStatic() {
    const bio = $("#about-bio");
    if (bio) bio.textContent = CONFIG.profile.bio;

    /* contacts */
    const box = $("#contacts");
    if (box) {
      box.innerHTML = CONFIG.socials.map((s) => {
        const icon = (s.icon === "website" || s.icon === "globe")
          ? `<svg viewBox="0 0 24 24" fill="none" stroke="#39ff88" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14 0 18M12 3c-3 3.5-3 14 0 18"/></svg>`
          : `<img src="https://cdn.simpleicons.org/${esc(s.icon)}/39ff88" alt="" loading="lazy">`;
        return `<a class="soc" href="${esc(s.url)}" target="_blank" rel="noopener">
          ${icon}
          <span><span class="soc-name">${esc(s.name)}</span><br><span class="soc-sub">${esc(s.sub)}</span></span>
        </a>`;
      }).join("");
    }

    /* skills — categories */
    const sk = $("#skills-list");
    if (sk) {
      const groups = CONFIG.skillGroups || [];
      sk.innerHTML = groups.map((g, i) => `
        <div class="skill-group">
          <div class="sg-head">
            <span class="sg-num">${String(i + 1).padStart(2, "0")}</span>
            <span class="sg-name">${esc(g.name)}</span>
          </div>
          <div class="sg-items">${g.items.map((it) => `<span class="sg-item">${esc(it)}</span>`).join("")}</div>
        </div>`).join("");
    }

    /* projects */
    const pr = $("#projects-list");
    if (pr) {
      const note = `<svg class="proj-icon proj-note" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>`;
      const deworld = `<img class="proj-icon proj-deworld" src="${esc(CONFIG.discord.icon)}" alt="DeWorld" loading="lazy">`;
      const cards = CONFIG.projects.map((p) => `
        <article class="card reveal">
          ${p.icon === "music" ? note
            : (p.icon === "website" || p.icon === "globe") ? deworld
            : `<img class="proj-icon" src="https://cdn.simpleicons.org/${esc(p.icon)}/39ff88" alt="" loading="lazy">`}
          <h3 class="proj-title">${esc(p.title)}</h3>
          <p class="proj-desc">${esc(p.desc)}</p>
          <a class="btn btn-solid" href="${esc(p.link)}" target="_blank" rel="noopener">${esc(p.btn)}</a>
        </article>`).join("");

      const o = CONFIG.openProject;
      const open = `
        <article class="card proj-open reveal">
          <h3 class="proj-title">${esc(o.title)}</h3>
          <p class="proj-desc">${esc(o.desc)}</p>
          <a class="btn" href="${esc(o.link)}" target="_blank" rel="noopener">${esc(o.btn)}</a>
        </article>`;

      pr.innerHTML = cards + open;
      if ("IntersectionObserver" in window) {
        $$(".reveal", pr).forEach((n) => {
          new IntersectionObserver((ents, obs) => {
            ents.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); obs.disconnect(); } });
          }, { threshold: 0.12 }).observe(n);
        });
      } else {
        $$(".reveal", pr).forEach((n) => n.classList.add("in"));
      }
    }
  }

  /* ============================================================
     GITHUB — stats images fallback
     ============================================================ */
  function ghImages() {
    $$(".gh-img").forEach((img) => {
      img.addEventListener("error", () => {
        img.replaceWith(Object.assign(document.createElement("div"), {
          className: "repo-desc",
          textContent: "статистика временно недоступна (github-readme-stats)",
        }));
      });
    });
  }

  /* ============================================================
     GITHUB — календарь: месяцы сверху, дни недели слева, 52 недели
     ============================================================ */
  async function githubGraph() {
    const canvas = $("#gh-graph");
    const totalEl = $("#gh-total");
    const lastEl = $("#gh-last");
    if (!canvas) return;
    const weeks = CONFIG.github.graphWeeks;
    const days = weeks * 7;

    let events = cache.get("gh_events", 15);
    if (!events) {
      try {
        events = await getJSON(
          `https://api.github.com/users/${CONFIG.github.user}/events/public?per_page=100`,
          { timeout: 9000 }
        );
        cache.set("gh_events", events);
      } catch (e) {
        if (totalEl) totalEl.textContent = "данные недоступны";
        if (lastEl) lastEl.textContent = "GitHub API временно недоступен";
        return;
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const counts = new Map();
    for (const e of events) {
      const d = new Date(e.created_at);
      d.setHours(0, 0, 0, 0);
      const diff = Math.round((today - d) / 86400000);
      if (diff >= 0 && diff < days) counts.set(diff, (counts.get(diff) || 0) + 1);
    }
    let total = 0;
    counts.forEach((v) => { total += v; });
    if (totalEl) totalEl.textContent = `${total} событий за ${weeks} недели`;

    // последнее действие
    if (lastEl && events.length) {
      const ev = events[0];
      const d = new Date(ev.created_at).toLocaleDateString("ru-RU", {
        day: "numeric", month: "short", year: "numeric",
      });
      const t = new Date(ev.created_at).toLocaleTimeString("ru-RU", {
        hour: "2-digit", minute: "2-digit",
      });
      let action = "";
      if (ev.type === "PushEvent") {
        const repo = (ev.repo && ev.repo.name) || "репозиторий";
        action = `${d} в ${t} — запушил в ${repo}`;
      } else if (ev.type === "CreateEvent") {
        action = `${d} в ${t} — создал ${(ev.payload && ev.payload.ref_type) || "объект"}`;
      } else if (ev.type === "IssuesEvent") {
        action = `${d} в ${t} — комментарий к issue`;
      } else if (ev.type === "PullRequestEvent") {
        action = `${d} в ${t} — pull request`;
      } else {
        action = `${d} в ${t} — ${ev.type}`;
      }
      lastEl.textContent = action;
    }

    const ctx = canvas.getContext("2d");
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const months = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
    const weekdays = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];
    const dow = (today.getDay() + 6) % 7; // понедельник = 0
    let w = 0, h = 0;

    function resize() {
      w = canvas.clientWidth || 300;
      h = canvas.clientHeight || 200;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function levelColor(v) {
      if (v === 0) return "#10201b";
      if (v === 1) return "#0e4429";
      if (v <= 3) return "#17a34a";
      if (v <= 6) return "#26e07a";
      return "#39ff88";
    }

    function mondayOf(col) {
      const d = new Date(today);
      d.setDate(today.getDate() - dow - (weeks - 1 - col) * 7);
      return d;
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      const gap = w < 420 ? 1 : 2;
      const left = w < 420 ? 24 : 30;
      const cellW = Math.max(3, Math.floor((w - left - 8 - gap * (weeks - 1)) / weeks));
      const cellH = Math.max(8, Math.min(28, Math.floor((h - 26 - 6 - gap * 6) / 7)));
      const gridW = cellW * weeks + gap * (weeks - 1);
      const gridH = cellH * 7 + gap * 6;
      const gridX = left + Math.max(0, (w - left - gridW) / 2);
      const gridY = Math.max(24, Math.floor((h - gridH) / 2) + 8);

      ctx.font = "9px monospace";
      ctx.textBaseline = "middle";

      // день недели | график
      ctx.textAlign = "right";
      weekdays.forEach((name, r) => {
        ctx.fillStyle = "rgba(150,180,165,0.8)";
        ctx.fillText(name, gridX - 6, gridY + r * (cellH + gap) + cellH / 2);
      });

      // месяц | месяц | месяц
      ctx.textAlign = "left";
      let lastMonth = -1;
      let lastMonthX = -Infinity;
      for (let col = 0; col < weeks; col++) {
        const monday = mondayOf(col);
        const month = monday.getMonth();
        const x = gridX + col * (cellW + gap);
        if (col === 0 || month !== lastMonth) {
          if (lastMonthX === -Infinity || x - lastMonthX >= 26) {
            ctx.fillStyle = "rgba(0,229,255,0.8)";
            ctx.fillText(months[month], x, gridY - 10);
            lastMonthX = x;
          }
          lastMonth = month;
        }

        for (let row = 0; row < 7; row++) {
          const date = new Date(monday);
          date.setDate(monday.getDate() + row);
          const diff = Math.round((today - date) / 86400000);
          const v = diff >= 0 && diff < days ? (counts.get(diff) || 0) : -1;
          ctx.fillStyle = v < 0 ? "rgba(16,32,27,0.35)" : levelColor(v);
          ctx.fillRect(x, gridY + row * (cellH + gap), cellW, cellH);
        }
      }
      ctx.textAlign = "left";
    }

    resize();
    draw();
    const redraw = () => { resize(); draw(); };
    if ("ResizeObserver" in window) {
      new ResizeObserver(redraw).observe(canvas);
    } else {
      addEventListener("resize", redraw);
    }
  }

  /* ============================================================
     GITHUB — random repo
     ============================================================ */
  async function randomRepo() {
    const btn = $("#repo-roll");
    const nameEl = $("#repo-name");
    if (!btn || !nameEl) return;
    let repos = cache.get("gh_repos", 30);

    if (!repos) {
      try {
        repos = await getJSON(
          `https://api.github.com/users/${CONFIG.github.user}/repos?per_page=100&sort=updated`,
          { timeout: 9000 }
        );
        cache.set("gh_repos", repos);
      } catch (e) { repos = []; }
    }

    /* карусель репозиториев — как у YouTube: точки + стрелки + автопрокрутка */
    const dotsBox = $("#repo-dots");
    const prevBtn = $("#repo-prev");
    const nextBtn = $("#repo-next");
    const n = repos ? repos.length : 0;
    let repoIdx = n > 1 ? Math.floor(Math.random() * n) : 0;
    let repoTimer = null;

    function renderCarousel() {
      if (!repos || !repos.length) return;
      const r = repos[repoIdx];
      nameEl.textContent = r.name;
      nameEl.style.cursor = "pointer";
      nameEl.title = r.html_url;
      nameEl.onclick = () => { window.open(r.html_url, "_blank"); };
      $("#repo-desc").textContent = r.description || "без описания";
      $("#repo-lang").textContent = r.language || "—";
      $("#repo-stars").textContent = "★ " + (r.stargazers_count || 0);
      $("#repo-upd").textContent = "upd " + new Date(r.pushed_at || r.updated_at).toLocaleDateString("ru-RU");
      $("#repo-link").href = r.html_url;
      $("#repo-index").textContent = `${repoIdx + 1}/${n}`;
      dotsBox.innerHTML = repos.map((_, i) =>
        `<button class="repo-dot${i === repoIdx ? " on" : ""}" data-i="${i}" aria-label="репозиторий ${i + 1}"></button>`
      ).join("");
    }

    function show(i) {
      if (!n) return;
      repoIdx = (i + n) % n;
      renderCarousel();
    }

    dotsBox.addEventListener("click", (e) => {
      const b = e.target.closest(".repo-dot");
      if (b) { show(+b.dataset.i); resetTimer(); }
    });
    prevBtn.addEventListener("click", () => { show(repoIdx - 1); resetTimer(); });
    nextBtn.addEventListener("click", () => { show(repoIdx + 1); resetTimer(); });
    btn.addEventListener("click", () => {
      if (!n) { $("#repo-desc").textContent = "репозитории не загрузились — попробуй позже"; return; }
      let i = repoIdx;
      if (n > 1) do { i = Math.floor(Math.random() * n); } while (i === repoIdx);
      show(i);
      resetTimer();
    });

    const resetTimer = () => {
      if (repoTimer) clearInterval(repoTimer);
      repoTimer = setInterval(() => show(repoIdx + 1), 6000);
    };

    const pauseTimer = () => { if (repoTimer) clearInterval(repoTimer); repoTimer = null; };
    const box = $(".repo-carousel");
    box.addEventListener("pointerenter", pauseTimer);
    box.addEventListener("pointerleave", () => { if (!repoTimer) resetTimer(); });

    renderCarousel();
    resetTimer();
  }

  /* ============================================================
     DISCORD — server widget
     ============================================================ */
  async function discordServer() {
    const { guild, serverUrl } = CONFIG.discord;
    const onlineEl = $("#dsc-online");
    try {
      const w = await getJSON(`https://discord.com/api/guilds/${guild}/widget.json`, { timeout: 9000 });
      if (onlineEl) onlineEl.textContent = typeof w.presence_count === "number" ? w.presence_count : "—";
      const nameEl = $("#dsc-name");
      if (nameEl && w.name) nameEl.textContent = w.name;
      const inv = $("#dsc-invite");
      if (inv && w.instant_invite) inv.href = w.instant_invite;

      const iconEl = $("#dsc-icon");
      if (iconEl) {
        iconEl.onerror = () => {
          if (CONFIG.discord.iconFallback && !iconEl.src.includes("deworld-mc-icon")) {
            iconEl.src = CONFIG.discord.iconFallback;
          } else {
            iconEl.hidden = true;
          }
        };
        iconEl.src = CONFIG.discord.icon;
        iconEl.hidden = false;
      }

      const box = $("#dsc-members");
      if (box && Array.isArray(w.members)) {
        box.innerHTML = w.members.slice(0, 14).map((m) => `
          <span class="dsc-m" title="${esc(m.username)}">
            <img src="${esc(m.avatar_url)}" alt="" loading="lazy">${esc(m.username)}
          </span>`).join("") || `<span class="soc-sub">никто не онлайн</span>`;
      } else if (box) {
        box.innerHTML = `<span class="soc-sub">никто не онлайн</span>`;
      }
    } catch (e) {
      if (onlineEl) onlineEl.textContent = "н/д";
      const box = $("#dsc-members");
      if (box) box.innerHTML = `<span class="soc-sub">список участников недоступен</span>`;
      const inv = $("#dsc-invite");
      if (inv) inv.href = serverUrl;
      const iconEl = $("#dsc-icon");
      if (iconEl && CONFIG.discord.icon) {
        iconEl.onerror = () => {
          if (CONFIG.discord.iconFallback && !iconEl.src.includes("deworld-mc-icon")) {
            iconEl.src = CONFIG.discord.iconFallback;
          } else iconEl.hidden = true;
        };
        iconEl.src = CONFIG.discord.icon;
        iconEl.hidden = false;
      }
    }
  }

  /* ============================================================
     DISCORD — personal card (Lanyard → guild widget fallback)
     ============================================================ */
  function renderEmoji(s) {
    return esc(s).replace(
      /&lt;(a?):([A-Za-z0-9_]{1,60}):(\d{5,30})&gt;/g,
      (m, anim, name, id) =>
        `<img class="dsc-emoji" src="https://cdn.discordapp.com/emojis/${id}.${anim ? "gif" : "png"}?quality=lossless" alt=":${name}:" title=":${name}:">`
    );
  }

  function statusEmoji(e) {
    if (!e) return "";
    if (e.id) {
      return `<img class="dsc-emoji" src="https://cdn.discordapp.com/emojis/${e.id}.${e.animated ? "gif" : "png"}?quality=lossless" alt="" title="${esc(e.name || "")}">`;
    }
    return esc(e.name || "");
  }

  function setDeco(img, uid, asset) {
    let tried = false;
    img.onload = () => { img.hidden = false; };
    img.onerror = () => {
      if (!tried) {
        tried = true;
        img.src = "https://cdn.discordapp.com/avatar-decoration-presets/" + asset + ".png";
      } else img.hidden = true;
    };
    img.src = "https://cdn.discordapp.com/avatar-decorations/" + encodeURIComponent(uid) + "/" + asset + ".png";
  }

  async function discordCard() {
    const stateEl = $("#lan-state");
    const led = $("#lan-led");
    const act = $("#lan-activity");
    const detail = $("#lan-detail");
    const ava = $("#lan-ava");
    const deco = $("#lan-deco");
    const map = {
      online: ["в сети", "led-on"],
      idle: ["ожидание", "led-blink"],
      dnd: ["не беспокоить", "led-off"],
      invisible: ["скрыт", ""],
      offline: ["оффлайн", "led-off"],
    };
    const widgetName = CONFIG.discord.widgetName || CONFIG.discord.tag;
    const bio = renderEmoji(CONFIG.discord.bio || CONFIG.profile.bio);
    const HISTORY_KEY = "bio:discord:games";

    function loadHistory() {
      try {
        const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
        return Array.isArray(h) ? h : [];
      } catch (e) { return []; }
    }

    // в истории только игры — статусы и био сюда не попадают
    function appendGame(name) {
      const clean = String(name || "").trim();
      if (!clean) return loadHistory();
      const h = loadHistory();
      const now = Date.now();
      if (!h.length || h[0].name !== clean || now - h[0].ts > 30 * 60 * 1000) {
        h.unshift({ ts: now, name: clean });
        const seen = new Set();
        const unique = h.filter((x) => {
          if (seen.has(x.name)) return false;
          seen.add(x.name);
          return true;
        });
        try { localStorage.setItem(HISTORY_KEY, JSON.stringify(unique.slice(0, 5))); }
        catch (e) { /* private mode */ }
        return unique.slice(0, 5);
      }
      return h;
    }

    function logTime(ts) {
      const d = new Date(ts);
      const now = new Date();
      const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
      if (d.toDateString() === now.toDateString()) return time;
      return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) + " " + time;
    }

    function paint(label, ledCls, activityHtml, gameName) {
      if (stateEl) stateEl.textContent = label;
      if (led) led.className = "led " + ledCls;
      if (act) act.innerHTML = activityHtml || bio;
      if (!detail) return;
      const h = appendGame(gameName);
      const items = h.length
        ? h.map((x) =>
            `<span class="dsc-log-item"><time>${esc(logTime(x.ts))}</time>${esc(x.name)}</span>`
          ).join("")
        : `<span class="dsc-log-item">игр пока не видно</span>`;
      detail.innerHTML =
        `<div class="dsc-detail-row"><span class="dsc-k">сейчас</span><span class="dsc-v">${gameName ? esc(gameName) : "не в игре"}</span></div>` +
        `<div class="dsc-detail-row"><span class="dsc-k">играл</span><span class="dsc-v dsc-log">${items}</span></div>` +
        `<div class="dsc-note">замечено на этом устройстве</div>`;
    }

    /* 1) Lanyard — живые данные: аним. аватар, рамка, текущая игра */
    try {
      const j = await getJSON(`https://api.lanyard.rest/v1/users/${CONFIG.discord.user}`, { timeout: 8000 });
      if (!j || !j.success || !j.data) throw new Error("no data");
      const d = j.data;
      const du = d.discord_user || {};
      const [label, ledCls] = map[d.discord_status] || ["—", ""];

      if (du.avatar && ava) {
        const ext = du.avatar.indexOf("a_") === 0 ? "gif" : "png";
        ava.src = `https://cdn.discordapp.com/avatars/${du.id}/${du.avatar}.${ext}?size=128`;
        ava.hidden = false;
      }
      if (deco && du.avatar_decoration_data && du.avatar_decoration_data.asset) {
        setDeco(deco, du.id, du.avatar_decoration_data.asset);
      }

      const activities = d.activities || [];
      const game = activities.find((a) => a.type === 0 && (a.name || a.details));
      const custom = activities.find((a) => a.type === 4 && (a.state || a.name));
      const spotify = d.listening_to_spotify && d.spotify;
      let html = "";
      let gameName = "";
      if (game) {
        gameName = game.name || "";
        html = `<span class="dim">в игре</span> · ${renderEmoji(gameName)}`;
      } else if (custom) {
        const emoji = statusEmoji(custom.emoji);
        const text = custom.state || custom.name || "";
        html = emoji + (emoji && text ? " " : "") + renderEmoji(text);
      } else if (spotify) {
        html = `♪ ${esc((spotify.artist_name || spotify.artist) + " — " + spotify.track)}`;
      }
      paint(label, ledCls, html || bio, gameName);
      return;
    } catch (e) { /* нет Lanyard → widget ниже */ }

    /* 2) Guild widget — статик-аватар + presence + игра */
    try {
      const w = await getJSON(`https://discord.com/api/guilds/${CONFIG.discord.guild}/widget.json`, { timeout: 9000 });
      const m = (w.members || []).find(
        (x) => String(x.username || "").toLowerCase() === String(widgetName || "").toLowerCase()
      );
      const [label, ledCls] = map[(m && m.status) || "offline"] || ["н/д", ""];
      if (m && m.avatar_url && ava) { ava.src = m.avatar_url; ava.hidden = false; }
      const gameName = (m && m.game && m.game.name) || "";
      paint(
        label, ledCls,
        gameName ? `<span class="dim">в игре</span> · ${esc(gameName)}` : bio,
        gameName
      );
    } catch (e2) {
      paint("н/д", "", bio, "");
    }
  }

  /* ============================================================
     MINECRAFT — server ping + MOTD
     ============================================================ */
  function minecraft() {
    const host = CONFIG.minecraft.host;
    const led = $("#mc-led");
    const state = $("#mc-state");

    $("#mc-addr").textContent = host;
    $("#mc-connect").href = `minecraft://?addServer=${encodeURIComponent(host)}`;

    const copyBtn = $("#mc-copy");
    copyBtn.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(host); }
      catch (e) {
        const ta = document.createElement("textarea");
        ta.value = host; document.body.appendChild(ta); ta.select();
        document.execCommand("copy"); ta.remove();
      }
      copyBtn.textContent = "скопировано!";
      setTimeout(() => (copyBtn.textContent = "копировать IP"), 1600);
    });

    const offline = () => {
      led.className = "led led-off";
      state.textContent = "offline";
      $("#mc-motd").textContent = "сервер сейчас не отвечает — попробуй позже";
      ready($("#mc-motd"));
      $("#mc-online").textContent = "0";
      $("#mc-max").textContent = "—";
      $("#mc-ping").textContent = "—";
      $("#mc-ver").textContent = "—";
    };

    async function ping() {
      const t0 = performance.now();
      try {
        const d = await getJSON(`https://api.mcstatus.io/v2/status/java/${host}`, { timeout: 10000 });
        const ms = Math.round(performance.now() - t0);
        if (!d.online) return offline();

        led.className = "led led-blink";
        state.textContent = "online";

        const icon = $("#mc-icon");
        if (d.icon) { icon.src = d.icon; icon.hidden = false; }

        $("#mc-addr").textContent = d.hostname || host;
        const clean = d.motd && d.motd.clean;
        $("#mc-motd").textContent =
          (Array.isArray(clean) ? clean.join("\n") : clean) || "—";
        ready($("#mc-motd"));
        $("#mc-online").textContent = d.players ? d.players.online : "—";
        $("#mc-max").textContent = d.players ? d.players.max : "—";
        $("#mc-ping").textContent = ms;
        $("#mc-ver").textContent = (d.version && d.version.name_clean) || "—";
      } catch (e) {
        console.error("[mc] ping failed:", e);
        offline();
      }
    }

    ping();
    setInterval(ping, CONFIG.minecraft.refreshMs);
  }

  /* ============================================================
     STEAM — live profile via r.jina.ai
     ============================================================ */
  async function steam() {
    const state = $("#st-state");
    const led = $("#st-led");
    const meta = $("#st-meta");
    const act = $("#st-activity");
    const child = (node, name) => {
      if (!node || !node.children) return "";
      const n = Array.from(node.children).find(
        (c) => c.localName.toLowerCase() === name.toLowerCase()
      );
      return n ? n.textContent.trim() : "";
    };

    const months = {
      jan: "янв", feb: "фев", mar: "мар", apr: "апр", may: "май", jun: "июн",
      jul: "июл", aug: "авг", sep: "сен", oct: "окт", nov: "ноя", dec: "дек",
    };
    const shortDate = (value) => {
      const s = String(value || "").trim();
      const m = s.match(/([A-Za-zА-Яа-я]+)\s+(\d{1,2}),?\s+(\d{2,4})/);
      if (m) {
        const mon = months[m[1].slice(0, 3).toLowerCase()] || m[1];
        const yy = m[3].length === 4 ? m[3].slice(2) : m[3];
        return `${String(m[2]).padStart(2, "0")} ${mon} ${yy}`;
      }
      const n = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})$/);
      if (n) {
        const yy = n[3].length === 4 ? n[3].slice(2) : n[3];
        return `${n[1].padStart(2, "0")}.${n[2].padStart(2, "0")}.${yy}`;
      }
      return s;
    };
    const shortPlace = {
      pavlodar: "Павлодар", moscow: "Москва", "saint petersburg": "СПб",
      kazakhstan: "Казахстан", russia: "Россия", ukraine: "Украина",
    };
    const shortLocation = (value) => {
      const first = String(value || "").split(",")[0].trim();
      return shortPlace[first.toLowerCase()] || first;
    };
    const hours = (value) => {
      const n = parseFloat(value);
      if (!Number.isFinite(n)) return String(value || "0");
      return n % 1 === 0 ? String(n) : n.toFixed(1);
    };

    try {
      let raw = await getText(
        "https://r.jina.ai/" + CONFIG.steam.url + "?xml=1",
        { headers: { "x-return-format": "html" }, timeout: 15000 }
      );
      // r.jina.ai добавляет служебный текст перед XML — вырезаем сам профиль
      const start = raw.indexOf("<?xml");
      const end = raw.lastIndexOf("</profile>");
      if (start < 0 || end < 0) throw new Error("no profile xml");
      raw = raw.slice(start, end + "</profile>".length);

      const doc = new DOMParser().parseFromString(raw, "text/xml");
      if (doc.querySelector("parsererror")) throw new Error("parse");

      const val = (name) => child(doc.documentElement, name);
      const stateRaw = val("onlineState").toLowerCase();
      const msg = val("stateMessage");
      const online = stateRaw === "online" || stateRaw === "in-game";
      const inGame = stateRaw === "in-game" || /\b(in-game|playing|в игре)\b/i.test(msg);
      const name = val("steamID") || CONFIG.steam.name;
      const avatar = val("avatarFull") || CONFIG.steam.avatar;

      const games = Array.from(doc.getElementsByTagName("mostPlayedGame")).map((g) => ({
        name: child(g, "gameName") || "—",
        hours: child(g, "hoursOnRecord") || "0",
        icon: child(g, "gameIcon").replace(/^http:/, "https:"),
      }));

      let current = "";
      if (inGame) {
        current = msg.replace(/^(in-game|playing|играет в|в игре)\s*:?\s*/i, "").trim();
        if (!current || /^online$/i.test(current)) current = games[0] && games[0].name;
      }

      const rows = [];
      if (current) {
        rows.push(
          `<span class="st-game"><span class="st-k">▸</span><span>${esc(current)}</span><b>сейчас</b></span>`
        );
      }
      games.filter((g) => g.name !== current).slice(0, 4).forEach((g) => {
        const icon = g.icon
          ? `<img src="${esc(g.icon)}" alt="" loading="lazy">`
          : `<span class="st-k">•</span>`;
        rows.push(
          `<span class="st-game">${icon}<span>${esc(g.name)}</span><b>${esc(hours(g.hours))} ч</b></span>`
        );
      });

      const since = shortDate(val("memberSince") || CONFIG.steam.memberSince);
      const place = shortLocation(val("location"));
      const metaText = [since ? `в Steam с ${since}` : "", place].filter(Boolean).join(" · ");

      const nameEl = $("#st-name");
      const avaEl = $("#st-ava");
      if (nameEl) nameEl.textContent = name;
      if (avaEl) avaEl.src = avatar;
      if (meta) meta.textContent = metaText || CONFIG.steam.url.replace(/^https?:\/\//, "");
      if (act) {
        act.innerHTML = rows.join("") || `<span class="user-activity">активность пока не видна</span>`;
      }
      if (state) state.textContent = inGame ? "в игре" : online ? "онлайн" : "оффлайн";
      if (led) led.className = "led " + (inGame ? "led-blink" : online ? "led-on" : "led-off");
    } catch (e) {
      const nameEl = $("#st-name");
      if (nameEl) nameEl.textContent = CONFIG.steam.name;
      if (meta) meta.textContent = "профиль Steam временно недоступен";
      if (act) {
        act.innerHTML = `<span class="user-activity">открой профиль напрямую, чтобы посмотреть игры</span>`;
      }
      if (state) state.textContent = "н/д";
      if (led) led.className = "led";
    }
  }

  /* ============================================================
     TWITCH — live status + hero player
     ============================================================ */
  function showLive(s, login, url) {
    const sec = $("#live");
    if (!sec) return;
    const t = $("#live-title");
    if (t) t.textContent = s.title || "—";
    const g = $("#live-game");
    if (g) g.textContent = (s.game && s.game.displayName) || "—";
    const v = $("#live-viewers");
    if (v) v.textContent = (s.viewersCount || 0).toLocaleString("ru-RU") + " зрителей";
    const a = $("#live-link");
    if (a) a.href = url;
    const f = $("#live-frame");
    if (f) {
      const src =
        "https://player.twitch.tv/?channel=" + encodeURIComponent(login) +
        "&parent=" + encodeURIComponent(location.hostname) +
        "&muted=true&autoplay=true";
      if (f.dataset.src !== src) { f.dataset.src = src; f.src = src; }
    }
    sec.hidden = false;
    requestAnimationFrame(() => dispatchEvent(new Event("resize")));
  }

  function hideLive() {
    const sec = $("#live");
    if (sec) sec.hidden = true;
    requestAnimationFrame(() => dispatchEvent(new Event("resize")));
  }

  async function twitch() {
    const { login, url, clientId } = CONFIG.twitch;
    const state = $("#tw-state");
    const thumb = $("#tw-thumb");
    const liveBadge = $("#tw-live");
    hideLive();
    thumb.src = `https://static-cdn.jtvnw.net/previews-ttv/live_user_${login}-440x248.jpg`;
    $("#tw-media").href = url;
    $("#tw-title").textContent = "проверяем, в эфире ли канал…";

    try {
      const j = await getJSON("https://gql.twitch.tv/gql", {
        method: "POST",
        timeout: 9000,
        headers: { "Content-Type": "application/json", "Client-Id": clientId },
        body: JSON.stringify({
          query:
            `query { user(login: "${login}") { profileImageURL(width: 300) ` +
            `stream { title viewersCount previewImageURL game { displayName } } } }`,
        }),
      });
      const user = j.data && j.data.user;
      if (!user) throw new Error("no user");

      if (user.stream) {
        const s = user.stream;
        liveBadge.hidden = false;
        state.innerHTML = `<span class="led led-live"></span>LIVE`;
        thumb.src = s.previewImageURL;
        $("#tw-title").textContent = s.title || "—";
        ready($("#tw-title"));
        $("#tw-game").textContent = (s.game && s.game.displayName) || "—";
        $("#tw-viewers").textContent = `${s.viewersCount} зрителей`;
        showLive(s, login, url);
      } else {
        liveBadge.hidden = true;
        state.textContent = "offline";
        thumb.src = user.profileImageURL;
        $("#tw-title").textContent = "сейчас не в эфире — но подписаться можно";
        ready($("#tw-title"));
        $("#tw-game").textContent = "";
        $("#tw-viewers").textContent = "";
      }
    } catch (e) {
      liveBadge.hidden = true;
      state.textContent = "н/д";
      $("#tw-title").textContent = "статус эфира недоступен — открой Twitch";
      ready($("#tw-title"));
      $("#tw-game").textContent = "";
      $("#tw-viewers").textContent = "";
    }
  }

  /* ============================================================
     YOUTUBE — latest videos carousel
     ============================================================ */
  async function youtube() {
    const track = $("#yt-track");
    const dotsBox = $("#yt-dots");
    const chLink = $("#yt-channel");
    if (!track) return;
    chLink.href = CONFIG.youtube.url;

    let items = cache.get("yt_feed", 10);
    if (!items) {
      try {
        const feed = `https://www.youtube.com/feeds/videos.xml?channel_id=${CONFIG.youtube.channelId}`;
        const j = await getJSON(
          `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed)}`,
          { timeout: 10000 }
        );
        if (j.status !== "ok") throw new Error("feed");
        items = (j.items || []).slice(0, 8);
        cache.set("yt_feed", items);
      } catch (e) {
        track.innerHTML = `<div class="yt-slide"><div class="repo-desc" style="padding:40px;text-align:center">
          не удалось загрузить видео — <a href="${CONFIG.youtube.url}" target="_blank" rel="noopener">открой канал</a></div></div>`;
        $("#yt-count").textContent = "н/д";
        ready($("#yt-count"));
        return;
      }
    }

    if (!items.length) {
      track.innerHTML = `<div class="yt-slide"><div class="repo-desc" style="padding:40px;text-align:center">видео не найдены</div></div>`;
      $("#yt-count").textContent = "0 видео";
      ready($("#yt-count"));
      return;
    }

    const vid = (link) => {
      const m = String(link).match(/(?:v=|\/shorts\/|\/embed\/|youtu\.be\/)([\w-]{11})/);
      return m ? m[1] : null;
    };

    track.innerHTML = items.map((it) => {
      const id = vid(it.link);
      const img = id
        ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
        : (it.thumbnail || "");
      const date = new Date(it.pubDate).toLocaleDateString("ru-RU");
      return `<div class="yt-slide">
        <a href="${esc(it.link)}" target="_blank" rel="noopener">
          <img src="${esc(img)}" alt="${esc(it.title)}" loading="lazy">
          <span class="yt-overlay">${esc(it.title)}<span class="yt-date">${date}</span></span>
        </a>
      </div>`;
    }).join("");

    $("#yt-count").textContent = `${items.length} видео`;
    ready($("#yt-count"));

    let idx = 0;
    const n = items.length;
    dotsBox.innerHTML = items
      .map((_, i) => `<button class="yt-dot${i === 0 ? " on" : ""}" data-i="${i}" aria-label="видео ${i + 1}"></button>`)
      .join("");

    const show = (i) => {
      idx = (i + n) % n;
      track.style.transform = `translateX(-${idx * 100}%)`;
      $$(".yt-dot", dotsBox).forEach((d, k) => d.classList.toggle("on", k === idx));
    };

    $("#yt-prev").addEventListener("click", () => show(idx - 1));
    $("#yt-next").addEventListener("click", () => show(idx + 1));
    dotsBox.addEventListener("click", (e) => {
      const b = e.target.closest(".yt-dot");
      if (b) show(+b.dataset.i);
    });

    if (!reduced) {
      let timer = setInterval(() => show(idx + 1), 7000);
      const box = $(".yt-carousel");
      box.addEventListener("pointerenter", () => { clearInterval(timer); timer = null; });
      box.addEventListener("pointerleave", () => {
        if (!timer) timer = setInterval(() => show(idx + 1), 7000);
      });
    }

    let sx = 0;
    track.addEventListener("pointerdown", (e) => (sx = e.clientX));
    track.addEventListener("pointerup", (e) => {
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 45) show(idx + (dx < 0 ? 1 : -1));
    });
  }

  /* анимированный заголовок страницы: печатается никнейм */
  function animateTitle() {
    const original = document.title;
    const target = CONFIG.profile.name + " — bio // DeWorld dev";
    document.title = "";
    let i = 0;
    const tick = () => {
      document.title = target.slice(0, i);
      i++;
      if (i <= target.length) setTimeout(tick, 55);
      else setTimeout(() => { document.title = original; }, 2000);
    };
    tick();
  }

  /* подсветка раздела в навигации при прокрутке */
  function scrollSpy() {
    const links = $$(".nav a");
    const sections = [];
    links.forEach((a) => {
      const id = a.getAttribute("href");
      if (id && id.indexOf("#") === 0) {
        const s = document.getElementById(id.slice(1));
        if (s) sections.push({ el: s, id: id.slice(1), link: a });
      }
    });
    if (!sections.length) return;

    const update = () => {
      const y = window.scrollY + innerHeight * 0.25;
      let hit = null;
      if (y > sections[0].el.offsetTop) {
        for (const s of sections) {
          const top = s.el.offsetTop;
          const bottom = top + s.el.offsetHeight;
          if (y >= top && y < bottom) hit = s.id;
        }
      }
      links.forEach((a) => {
        const id = a.getAttribute("href");
        if (id && id.indexOf("#") === 0) {
          a.classList.toggle("active", id.slice(1) === hit);
        }
      });
    };
    update();
    addEventListener("scroll", update, { passive: true });
  }

  /* ============================================================
     INIT
     ============================================================ */
  renderStatic();
  ghImages();
  clocks();
  reveals();
  animateTitle();
  scrollSpy();
  boot();
  matrix();

  githubGraph();
  randomRepo();
  discordServer();
  discordCard();
  minecraft();
  steam();
  twitch();
  youtube();

  /* блокировка контекстного меню ПКМ */
  document.addEventListener("contextmenu", (ev) => ev.preventDefault());
})();
