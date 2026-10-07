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
    const fmt = new Intl.DateTimeFormat("ru-RU", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const tzEl = $("#clk-tz");
    if (tzEl) tzEl.textContent = tz;

    const tick = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const ss = String(now.getSeconds()).padStart(2, "0");
      const t = `${hh}:${mm}:${ss}`;
      ["#topclock", "#hero-clock", "#clk-time"].forEach((s) => {
        const el = $(s); if (el) el.textContent = t;
      });
      const d = $("#clk-date"); if (d) d.textContent = fmt.format(now);
      const bar = $("#clk-bar-w");
      if (bar) {
        const pct = ((now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400) * 100;
        bar.style.width = pct.toFixed(2) + "%";
      }
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ============================================================
     REVEAL + SECTION TITLE TYPING
     ============================================================ */
  function reveals() {
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
        const icon = s.icon === "website"
          ? `<svg viewBox="0 0 24 24" fill="none" stroke="#39ff88" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14 0 18M12 3c-3 3.5-3 14 0 18"/></svg>`
          : `<img src="https://cdn.simpleicons.org/${esc(s.icon)}/39ff88" alt="" loading="lazy">`;
        return `<a class="soc" href="${esc(s.url)}" target="_blank" rel="noopener">
          ${icon}
          <span><span class="soc-name">${esc(s.name)}</span><br><span class="soc-sub">${esc(s.sub)}</span></span>
        </a>`;
      }).join("");
    }

    /* skills */
    const sk = $("#skills-list");
    if (sk) {
      sk.innerHTML = CONFIG.skills.map((s) => `
        <div class="skill" data-level="${s.level}">
          <div class="skill-top">
            <span class="skill-name">${esc(s.label)}</span>
            <span class="skill-lvl">${s.level}%</span>
          </div>
          <div class="skill-track"><div class="skill-fill"></div></div>
        </div>`).join("");

      const sio = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          sio.unobserve(e.target);
          const fill = $(".skill-fill", e.target);
          setTimeout(() => { fill.style.width = e.target.dataset.level + "%"; }, 120);
        }
      }, { threshold: 0.4 });
      $$(".skill", sk).forEach((n) => sio.observe(n));
    }

    /* projects */
    const pr = $("#projects-list");
    if (pr) {
      const cards = CONFIG.projects.map((p) => `
        <article class="card reveal">
          <img class="proj-icon" src="https://cdn.simpleicons.org/${esc(p.icon)}/39ff88" alt="" loading="lazy">
          <h3 class="proj-title">${esc(p.title)}</h3>
          <p class="proj-desc">${esc(p.desc)}</p>
          <div class="chips">${p.chips.map((c) => `<span class="chip">${esc(c)}</span>`).join("")}</div>
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
      $$(".reveal", pr).forEach((n) => {
        new IntersectionObserver((ents, obs) => {
          ents.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); obs.disconnect(); } });
        }, { threshold: 0.12 }).observe(n);
      });
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
     GITHUB — activity graph
     ============================================================ */
  async function ghGraph() {
    const canvas = $("#gh-graph");
    const totalEl = $("#gh-total");
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
        if (totalEl) totalEl.textContent = "api rate limit";
        draw([], true);
        return;
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const counts = new Array(days).fill(0);
    for (const e of events) {
      const d = new Date(e.created_at);
      d.setHours(0, 0, 0, 0);
      const diff = Math.round((today - d) / 86400000);
      const idx = days - 1 - diff;
      if (idx >= 0 && idx < days) counts[idx]++;
    }
    const total = counts.reduce((a, b) => a + b, 0);
    if (totalEl) totalEl.textContent = `${total} событий / ${weeks} нед.`;

    const level = (n) => (n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 6 ? 3 : 4);
    const colors = ["#10201b", "#0e4429", "#17a34a", "#26e07a", "#39ff88"];

    function draw(data, failed) {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const w = canvas.clientWidth || 600;
      const h = 140;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      if (failed) {
        ctx.fillStyle = "#5f7a70";
        ctx.font = "13px monospace";
        ctx.fillText("нет данных (лимит GitHub API — обновится позже)", 8, 70);
        return;
      }

      const gap = 4;
      const startY = 10;
      const cell = Math.floor(Math.min(
        (w - gap * weeks) / weeks,
        (h - startY - 6 - gap * 6) / 7,
        16
      ));
      const gridW = cell * weeks + gap * (weeks - 1);
      const startX = Math.max(0, (w - gridW) / 2);

      for (let c = 0; c < weeks; c++) {
        for (let r = 0; r < 7; r++) {
          const idx = c * 7 + r;
          const v = data[idx] || 0;
          const offset = days - 1 - idx;
          const dt = new Date(today.getTime() - offset * 86400000);
          ctx.fillStyle = colors[level(v)];
          ctx.fillRect(startX + c * (cell + gap), startY + r * (cell + gap), cell, cell);
          canvas._cells = canvas._cells || [];
          canvas._cells[idx] = { x: startX + c * (cell + gap), y: startY + r * (cell + gap), dt, v };
        }
      }

      canvas.onmousemove = (ev) => {
        const rect = canvas.getBoundingClientRect();
        const mx = ev.clientX - rect.left;
        const my = ev.clientY - rect.top;
        let tip = "";
        for (const cellInfo of canvas._cells) {
          if (!cellInfo) continue;
          if (mx >= cellInfo.x && mx <= cellInfo.x + cell && my >= cellInfo.y && my <= cellInfo.y + cell) {
            tip = `${cellInfo.dt.toLocaleDateString("ru-RU")}: ${cellInfo.v} событий`;
            break;
          }
        }
        canvas.title = tip;
      };
    }

    draw(counts);
    addEventListener("resize", () => draw(counts));
  }

  /* ============================================================
     GITHUB — random repo
     ============================================================ */
  async function randomRepo() {
    const btn = $("#repo-roll");
    const nameEl = $("#repo-name");
    if (!btn || !nameEl) return;
    let repos = cache.get("gh_repos", 30);
    let loaded = !!repos;
    let last = -1;

    const pick = () => {
      if (!loaded) return;
      if (!repos || !repos.length) {
        $("#repo-desc").textContent = "репозитории не загрузились — попробуй позже";
        return;
      }
      let i;
      do { i = Math.floor(Math.random() * repos.length); } while (repos.length > 1 && i === last);
      last = i;
      const r = repos[i];
      nameEl.textContent = r.name;
      $("#repo-desc").textContent = r.description || "без описания";
      $("#repo-lang").textContent = r.language || "—";
      $("#repo-stars").textContent = "★ " + (r.stargazers_count || 0);
      $("#repo-upd").textContent = "upd " + new Date(r.pushed_at || r.updated_at).toLocaleDateString("ru-RU");
      $("#repo-link").href = r.html_url;
      $("#repo-index").textContent = `${i + 1}/${repos.length}`;
    };

    btn.addEventListener("click", pick);

    if (!repos) {
      try {
        repos = await getJSON(
          `https://api.github.com/users/${CONFIG.github.user}/repos?per_page=100&sort=updated`,
          { timeout: 9000 }
        );
        cache.set("gh_repos", repos);
      } catch (e) { repos = []; }
    }
    loaded = true;
    pick();
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

      const box = $("#dsc-members");
      if (box && Array.isArray(w.members)) {
        box.innerHTML = w.members.slice(0, 14).map((m) => `
          <span class="dsc-m" title="${esc(m.username)}">
            <img src="${esc(m.avatar_url)}" alt="" loading="lazy">${esc(m.username)}
          </span>`).join("") || `<span class="soc-sub">никто не онлайн</span>`;
      }
    } catch (e) {
      if (onlineEl) onlineEl.textContent = "н/д";
      const inv = $("#dsc-invite");
      if (inv) inv.href = serverUrl;
    }
  }

  /* ============================================================
     DISCORD — personal status (Lanyard)
     ============================================================ */
  async function lanyard() {
    const stateEl = $("#lan-state");
    const led = $("#lan-led");
    const act = $("#lan-activity");
    const ava = $("#lan-ava");
    const map = {
      online: ["в сети", "led-on"],
      idle: ["ожидание", "led-blink"],
      dnd: ["не беспокоить", "led-off"],
      invisible: ["скрыт", ""],
    };
    try {
      const j = await getJSON(`https://api.lanyard.rest/v1/users/${CONFIG.discord.user}`, { timeout: 8000 });
      if (!j || !j.success) throw new Error("no data");
      const d = j.data;
      const [label, ledCls] = map[d.discord_status] || ["—", ""];
      if (stateEl) stateEl.textContent = label;
      led.className = "led " + ledCls;

      const sp = d.spotify;
      const game = (d.activities || []).find((a) => a.type !== 0 && a.type !== 3);
      if (sp && sp.track) act.textContent = `♪ ${sp.artist_name} — ${sp.track}`;
      else if (game) act.textContent = game.details || game.name;
      else act.textContent = label;

      if (d.discord_user && d.discord_user.avatar && ava) {
        ava.src = `https://cdn.discordapp.com/avatars/${d.discord_user.id}/${d.discord_user.avatar}.png?size=64`;
        ava.hidden = false;
      }
    } catch (e) {
      if (stateEl) stateEl.textContent = "н/д";
      led.className = "led";
      if (act) act.textContent = "статус скрыт — открой discord.deworld.su";
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
      $("#mc-motd").textContent = "сервер недоступен :(";
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
    const act = $("#st-activity");
    try {
      const xml = await getText(
        "https://r.jina.ai/" + CONFIG.steam.url + "?xml=1",
        { headers: { "x-return-format": "html" }, timeout: 15000 }
      );
      const doc = new DOMParser().parseFromString(xml, "text/xml");
      if (doc.querySelector("parsererror")) throw new Error("parse");

      const val = (sel) => {
        const n = doc.querySelector(sel);
        return n ? n.textContent.trim() : "";
      };

      const online = val("onlinestate") === "online";
      const name = val("steamid") || CONFIG.steam.name;
      const avatar = val("avatarfull") || CONFIG.steam.avatar;
      const since = val("memberSince") || CONFIG.steam.memberSince;

      $("#st-name").textContent = name;
      $("#st-ava").src = avatar;
      act.textContent = (online ? "в сети" : "не в сети") + " • в Steam с " + since;
      state.textContent = online ? "online" : "offline";
      led.className = "led " + (online ? "led-on" : "led-off");
    } catch (e) {
      $("#st-name").textContent = CONFIG.steam.name;
      act.textContent = "профиль: " + CONFIG.steam.url.replace("https://", "");
      state.textContent = "н/д";
      led.className = "led";
    }
  }

  /* ============================================================
     TWITCH — live status
     ============================================================ */
  async function twitch() {
    const { login, url, clientId } = CONFIG.twitch;
    const state = $("#tw-state");
    const thumb = $("#tw-thumb");
    const liveBadge = $("#tw-live");
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
        $("#tw-game").textContent = (s.game && s.game.displayName) || "—";
        $("#tw-viewers").textContent = `${s.viewersCount} зрителей`;
      } else {
        liveBadge.hidden = true;
        state.textContent = "offline";
        thumb.src = user.profileImageURL;
        $("#tw-title").textContent = "сейчас не в эфире — но подписаться можно";
        $("#tw-game").textContent = "—";
        $("#tw-viewers").textContent = "—";
      }
    } catch (e) {
      liveBadge.hidden = true;
      state.textContent = "н/д";
      $("#tw-title").textContent = "не в эфире (статус проверить не удалось)";
      $("#tw-game").textContent = "—";
      $("#tw-viewers").textContent = "—";
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
        return;
      }
    }

    if (!items.length) {
      track.innerHTML = `<div class="yt-slide"><div class="repo-desc" style="padding:40px;text-align:center">видео не найдены</div></div>`;
      $("#yt-count").textContent = "0 видео";
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

  /* ============================================================
     INIT
     ============================================================ */
  renderStatic();
  ghImages();
  clocks();
  reveals();
  boot();
  matrix();

  ghGraph();
  randomRepo();
  discordServer();
  lanyard();
  minecraft();
  steam();
  twitch();
  youtube();
})();
