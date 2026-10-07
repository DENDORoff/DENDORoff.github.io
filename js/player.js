/* ============================================================
   DENDOR bio — music player
   Автодискавери MP3 из music/ + ID3-теги + визуализатор.
   ============================================================ */
(() => {
  "use strict";

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const cfg = (typeof CONFIG !== "undefined" && CONFIG.music) || {};
  const DIR = cfg.dir || "music";
  const REPO = cfg.repo || "DENDORoff/DENDORoff.github.io";
  const AUDIO_RE = /\.(mp3|ogg|oga|wav|m4a|aac|flac)$/i;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  window.MUSIC = window.MUSIC || { pulse: 0, playing: false };

  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));

  async function getJSON(url, timeout) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout || 9000);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  function lsGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, val); } catch (e) { /* private mode */ }
  }

  /* ============================================================
     ID3v2 (2.3 / 2.4 / 2.2) — title, artist, album, cover
     ============================================================ */
  function deUnsync(u8) {
    const out = new Uint8Array(u8.length);
    let n = 0;
    for (let i = 0; i < u8.length; i++) {
      out[n++] = u8[i];
      if (u8[i] === 0xff && i + 1 < u8.length && u8[i + 1] === 0x00) i++;
    }
    return out.subarray(0, n);
  }

  function synchU8(d, off) {
    return ((d[off] & 0x7f) << 21) | ((d[off + 1] & 0x7f) << 14) |
           ((d[off + 2] & 0x7f) << 7) | (d[off + 3] & 0x7f);
  }

  function plainU32(d, off) {
    return (d[off] * 16777216) + (d[off + 1] << 16) + (d[off + 2] << 8) + d[off + 3];
  }

  function decodeText(enc, b) {
    try {
      let s = "";
      if (enc === 0) s = new TextDecoder("iso-8859-1").decode(b);
      else if (enc === 3) s = new TextDecoder("utf-8").decode(b);
      else if (enc === 2) s = new TextDecoder("utf-16be").decode(b);
      else if (enc === 1) {
        if (b.length >= 2 && b[0] === 0xff && b[1] === 0xfe) s = new TextDecoder("utf-16le").decode(b.subarray(2));
        else if (b.length >= 2 && b[0] === 0xfe && b[1] === 0xff) s = new TextDecoder("utf-16be").decode(b.subarray(2));
        else s = new TextDecoder("utf-16le").decode(b);
      }
      return s.split("\u0000")[0].replace(/^\uFEFF/, "").trim();
    } catch (e) { return ""; }
  }

  function sniffMime(b) {
    if (b.length < 4) return "";
    if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
    if (b[0] === 0x89 && b[1] === 0x50) return "image/png";
    if (b[0] === 0x47 && b[1] === 0x49) return "image/gif";
    if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57) return "image/webp";
    return "";
  }

  function parseID3(buf) {
    if (!buf || buf.byteLength < 20) return null;
    const dv = new DataView(buf, 0, 10);
    if (dv.getUint8(0) !== 0x49 || dv.getUint8(1) !== 0x44 || dv.getUint8(2) !== 0x33) return null;
    const ver = dv.getUint8(3);
    if (ver < 2 || ver > 4) return null;
    const flags = dv.getUint8(5);
    let tagSize = synchU8(new Uint8Array(buf, 0, 10), 6) + 10;
    if (flags & 0x10) tagSize += 10;
    const avail = Math.min(buf.byteLength, tagSize);
    let data = new Uint8Array(buf, 10, Math.max(0, avail - 10));
    if (flags & 0x80) data = deUnsync(data);

    const out = { title: "", artist: "", album: "", cover: null };
    let pos = 0;

    if (flags & 0x40 && data.length > 4) {
      if (ver === 4) pos = synchU8(data, 0);
      else pos = 4 + plainU32(data, 0);
      if (pos < 0 || pos >= data.length) pos = 0;
    }

    const textIds = ver === 2
      ? { TT2: "title", TP1: "artist", TAL: "album" }
      : { TIT2: "title", TPE1: "artist", TALB: "album" };
    const picId = ver === 2 ? "PIC" : "APIC";
    const hdr = ver === 2 ? 6 : 10;

    let guard = 0;
    while (pos + hdr <= data.length && guard++ < 400) {
      let id = "";
      for (let k = 0; k < (ver === 2 ? 3 : 4); k++) id += String.fromCharCode(data[pos + k]);
      if (!/^[A-Z][A-Z0-9]{2,3}$/.test(id)) break;

      let size = 0;
      if (ver === 2) size = (data[pos + 3] << 16) | (data[pos + 4] << 8) | data[pos + 5];
      else if (ver === 4) {
        size = synchU8(data, pos + 4);
        if (size <= 0 || pos + hdr + size > data.length) {
          const alt = plainU32(data, pos + 4);
          if (alt > 0 && pos + hdr + alt <= data.length) size = alt;
        }
      } else size = plainU32(data, pos + 4);

      if (size <= 0 || pos + hdr + size > data.length) break;
      const fd = data.subarray(pos + hdr, pos + hdr + size);
      const target = textIds[id];

      if (target && fd.length > 1 && !out[target]) {
        out[target] = decodeText(fd[0], fd.subarray(1));
      } else if (id === picId && fd.length > 8 && !out.cover) {
        try {
          const enc = fd[0];
          let p = 1;
          if (ver === 2) {
            p += 3;
          } else {
            while (p < fd.length && fd[p] !== 0) p++;
            p++;
          }
          p++;
          if (enc === 1) {
            while (p + 1 < fd.length && !(fd[p] === 0 && fd[p + 1] === 0)) p += 2;
            p += 2;
          } else {
            while (p < fd.length && fd[p] !== 0) p++;
            p++;
          }
          const img = fd.subarray(p);
          const mime = sniffMime(img);
          if (mime && img.length > 128) out.cover = { bytes: img, mime: mime };
        } catch (e) { /* bad frame */ }
      }
      pos += hdr + size;
    }
    return out;
  }

  async function fetchTags(src) {
    let res = await fetch(src, { headers: { Range: "bytes=0-131071" } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    let buf = await res.arrayBuffer();
    if (buf.byteLength >= 10) {
      const head = new Uint8Array(buf, 0, 10);
      if (head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) {
        const need = synchU8(head, 6) + 10;
        if (need > buf.byteLength && need < 8 * 1024 * 1024) {
          const r2 = await fetch(src, { headers: { Range: "bytes=0-" + (need - 1) } });
          if (r2.ok) buf = await r2.arrayBuffer();
        }
      }
    }
    return parseID3(buf);
  }

  /* ============================================================
     helpers
     ============================================================ */
  function encodePath(p) {
    return String(p).split("/").map(encodeURIComponent).join("/");
  }

  function fromName(name) {
    const base = name.replace(/\.[^.]+$/, "").replace(/_/g, " ").trim();
    const m = base.split(" - ");
    if (m.length >= 2 && m[0].trim()) {
      return { artist: m[0].trim(), title: m.slice(1).join(" - ").trim() };
    }
    return { artist: "", title: base };
  }

  function fmtTime(sec) {
    if (!isFinite(sec) || sec < 0) return "0:00";
    const s = Math.round(sec);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    const mm = h ? String(m).padStart(2, "0") : String(m);
    return (h ? h + ":" : "") + mm + ":" + String(r).padStart(2, "0");
  }

  function metaKey(src) { return "bio:id3:" + src; }

  function loadMeta(src, size) {
    try {
      const raw = lsGet(metaKey(src));
      if (!raw) return null;
      const o = JSON.parse(raw);
      if (size && o.s && o.s !== size) return null;
      if (o.t === undefined && o.a === undefined) return null;
      return { title: o.t || "", artist: o.a || "", album: o.b || "" };
    } catch (e) { return null; }
  }

  function saveMeta(t) {
    try {
      lsSet(metaKey(t.src), JSON.stringify({
        s: t.size || 0, t: t.title || "", a: t.artist || "", b: t.album || "",
      }));
    } catch (e) { /* quota */ }
  }

  /* ============================================================
     discovery
     ============================================================ */
  let apiFailed = false;

  async function discover() {
    if (cfg.tracks && cfg.tracks.length) {
      return cfg.tracks.map((t) => {
        const file = typeof t === "string" ? t : t.file;
        const name = file.split("/").pop();
        const fb = fromName(name);
        return {
          src: encodePath(file), name: name, size: 0,
          title: t.title || fb.title, artist: t.artist || fb.artist, album: "",
          hydrated: !!(t.title || t.artist),
        };
      });
    }
    try {
      const items = await getJSON(
        "https://api.github.com/repos/" + REPO + "/contents/" + encodeURIComponent(DIR), 9000
      );
      if (!Array.isArray(items)) return [];
      return items
        .filter((f) => f.type === "file" && AUDIO_RE.test(f.name))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }))
        .map((f) => {
          const name = f.name;
          const fb = fromName(name);
          const c = loadMeta(DIR + "/" + name, f.size);
          return {
            src: encodePath(DIR + "/" + name), name: name, size: f.size,
            title: c ? c.title : fb.title, artist: c ? c.artist : fb.artist,
            album: c ? c.album : "", hydrated: !!c,
          };
        });
    } catch (e) {
      if (!/HTTP 404/.test(String(e && e.message))) apiFailed = true;
      return [];
    }
  }

  /* ============================================================
     player
     ============================================================ */
  function musicPlayer() {
    const card = $("#pl-card");
    if (!card) return;

    const ui = {
      led: $("#pl-led"), state: $("#pl-state"),
      art: $("#pl-art"), ph: $("#pl-ph"), num: $("#pl-num"),
      title: $("#pl-title"), artist: $("#pl-artist"),
      seek: $("#pl-seek"), fill: $("#pl-fill"), knob: $("#pl-knob"),
      cur: $("#pl-cur"), dur: $("#pl-dur"),
      prev: $("#pl-prev"), play: $("#pl-play"), next: $("#pl-next"),
      mute: $("#pl-mute"), range: $("#pl-range"), count: $("#pl-count"),
      viz: $("#pl-viz"), list: $("#pl-list"),
    };

    const audio = new Audio();
    audio.preload = "metadata";

    let tracks = [];
    let cur = -1;
    let scrubbing = false;
    let seekPct = 0;

    /* --- volume --- */
    const savedVol = parseInt(lsGet("bio:vol"), 10);
    let vol = isFinite(savedVol) && savedVol >= 0 && savedVol <= 100
      ? savedVol
      : (cfg.volume || 80);
    audio.volume = vol / 100;
    if (ui.range) ui.range.value = String(vol);

    function setState(cls, text) {
      if (ui.led) ui.led.className = "led " + cls;
      if (ui.state) ui.state.textContent = text;
    }

    function label(t) {
      if (!t) return "—";
      if (t.artist && t.title) return t.artist + " — " + t.title;
      return t.title || t.name || "—";
    }

    function applyUI() {
      const t = tracks[cur];
      if (!t) return;
      if (ui.title) ui.title.textContent = t.title || fromName(t.name).title;
      if (ui.artist) ui.artist.textContent = t.artist || "без тегов (файл: " + t.name + ")";
      if (ui.num) ui.num.textContent = (cur + 1) + "/" + tracks.length;
      if (ui.count) ui.count.textContent = tracks.length + " трек.";
      if (ui.art) {
        if (t.coverUrl) { ui.art.src = t.coverUrl; ui.art.hidden = false; if (ui.ph) ui.ph.hidden = true; }
        else { ui.art.hidden = true; if (ui.ph) ui.ph.hidden = false; }
      }
      $$(".pl-item", ui.list).forEach((n, i) => n.classList.toggle("on", i === cur));
      mediaSession(t);
    }

    function mediaSession(t) {
      if (!("mediaSession" in navigator) || typeof MediaMetadata === "undefined") return;
      try {
        const meta = { title: t.title || t.name, artist: t.artist || "", album: t.album || "" };
        if (t.coverUrl) meta.artwork = [{ src: t.coverUrl, type: t.coverMime || "image/jpeg" }];
        navigator.mediaSession.metadata = new MediaMetadata(meta);
      } catch (e) { /* unsupported */ }
    }

    function renderList() {
      if (!ui.list) return;
      if (!tracks.length) {
        ui.list.innerHTML = "";
        return;
      }
      ui.list.innerHTML = tracks.map((t, i) => `
        <li class="pl-item${i === cur ? " on" : ""}" data-i="${i}" tabindex="0" role="button">
          <span class="pl-num">${String(i + 1).padStart(2, "0")}</span>
          <span class="pl-name">${esc(label(t))}</span>
        </li>`).join("");
    }

    async function hydrate(i) {
      const t = tracks[i];
      if (!t || t.hydrated) return;
      t.hydrated = true;
      try {
        const tags = await fetchTags(t.src);
        if (tags) {
          if (tags.title) t.title = tags.title;
          if (tags.artist) t.artist = tags.artist;
          if (tags.album) t.album = tags.album;
          if (tags.cover) {
            try {
              t.coverUrl = URL.createObjectURL(new Blob([tags.cover.bytes], { type: tags.cover.mime }));
              t.coverMime = tags.cover.mime;
            } catch (e) { /* blob */ }
          }
          saveMeta(t);
        }
      } catch (e) { /* no tags */ }
      if (tracks[i] === t) {
        renderList();
        if (tracks[cur] === t) applyUI();
      }
    }

    async function hydrateAll() {
      for (let i = 0; i < tracks.length; i++) {
        await hydrate(i);
        if (i === cur) applyUI();
      }
    }

    function load(i, play) {
      if (!tracks.length) return;
      cur = ((i % tracks.length) + tracks.length) % tracks.length;
      const t = tracks[cur];
      audio.src = t.src;
      audio.load();
      applyUI();
      setState("led-blink", "загрузка…");
      hydrate(cur);
      if (play) startPlay();
    }

    async function startPlay() {
      ensureGraph();
      try {
        await audio.play();
      } catch (e) {
        setState("led-off", "нажми ▶");
      }
    }

    function toggle() {
      if (!tracks.length) return;
      if (cur < 0) { load(0, true); return; }
      if (audio.paused) startPlay();
      else audio.pause();
    }

    function nextTrack() { if (tracks.length) load(cur + 1, true); }
    function prevTrack() {
      if (!tracks.length) return;
      if (audio.currentTime > 3) { audio.currentTime = 0; return; }
      load(cur - 1, true);
    }

    /* --- audio events --- */
    audio.addEventListener("play", () => {
      window.MUSIC.playing = true;
      if (ui.play) ui.play.textContent = "||";
      if (ui.play) ui.play.setAttribute("aria-label", "пауза");
      setState("led-on", "играет");
      if (ui.viz && !viz.raf && !reduced) drawLoop();
    });

    audio.addEventListener("pause", () => {
      window.MUSIC.playing = false;
      if (ui.play) ui.play.textContent = ">";
      if (ui.play) ui.play.setAttribute("aria-label", "воспроизвести");
      setState("led-blink", "пауза");
    });

    audio.addEventListener("ended", nextTrack);

    audio.addEventListener("loadedmetadata", () => {
      if (ui.dur) ui.dur.textContent = fmtTime(audio.duration);
      setState(audio.paused ? "led-blink" : "led-on", audio.paused ? "нажми ▶" : "играет");
    });

    audio.addEventListener("timeupdate", () => {
      if (scrubbing) return;
      const d = audio.duration || 0;
      const pct = d ? (audio.currentTime / d) * 100 : 0;
      if (ui.fill) ui.fill.style.width = pct + "%";
      if (ui.knob) ui.knob.style.left = pct + "%";
      if (ui.cur) ui.cur.textContent = fmtTime(audio.currentTime);
      if (ui.seek) ui.seek.setAttribute("aria-valuenow", String(Math.round(pct)));
    });

    audio.addEventListener("error", () => {
      if (!audio.src) return;
      setState("led-off", "ошибка файла");
    });

    /* --- controls --- */
    if (ui.play) ui.play.addEventListener("click", toggle);
    if (ui.next) ui.next.addEventListener("click", nextTrack);
    if (ui.prev) ui.prev.addEventListener("click", prevTrack);

    if (ui.range) {
      ui.range.addEventListener("input", () => {
        vol = parseInt(ui.range.value, 10) || 0;
        audio.volume = vol / 100;
        audio.muted = false;
        if (ui.mute) ui.mute.classList.remove("muted");
        lsSet("bio:vol", String(vol));
      });
    }

    if (ui.mute) {
      ui.mute.addEventListener("click", () => {
        audio.muted = !audio.muted;
        ui.mute.classList.toggle("muted", audio.muted);
      });
    }

    if ("mediaSession" in navigator) {
      try {
        navigator.mediaSession.setActionHandler("play", () => { if (audio.paused) startPlay(); });
        navigator.mediaSession.setActionHandler("pause", () => audio.pause());
        navigator.mediaSession.setActionHandler("nexttrack", nextTrack);
        navigator.mediaSession.setActionHandler("previoustrack", prevTrack);
      } catch (e) { /* unsupported action */ }
    }

    /* --- seek (pointer) --- */
    if (ui.seek) {
      const pctFromEvent = (ev) => {
        const r = ui.seek.getBoundingClientRect();
        return Math.max(0, Math.min(1, (ev.clientX - r.left) / (r.width || 1)));
      };
      const preview = (p) => {
        if (ui.fill) ui.fill.style.width = p * 100 + "%";
        if (ui.knob) ui.knob.style.left = p * 100 + "%";
        if (ui.cur) ui.cur.textContent = fmtTime((audio.duration || 0) * p);
      };
      ui.seek.addEventListener("pointerdown", (ev) => {
        if (!tracks.length || !isFinite(audio.duration)) return;
        scrubbing = true;
        seekPct = pctFromEvent(ev);
        preview(seekPct);
        try { ui.seek.setPointerCapture(ev.pointerId); } catch (e) { /* noop */ }
      });
      ui.seek.addEventListener("pointermove", (ev) => {
        if (!scrubbing) return;
        seekPct = pctFromEvent(ev);
        preview(seekPct);
      });
      const commit = () => {
        if (!scrubbing) return;
        scrubbing = false;
        if (isFinite(audio.duration)) audio.currentTime = audio.duration * seekPct;
      };
      ui.seek.addEventListener("pointerup", commit);
      ui.seek.addEventListener("pointercancel", commit);
    }

    /* --- playlist clicks --- */
    if (ui.list) {
      ui.list.addEventListener("click", (ev) => {
        const li = ev.target.closest(".pl-item");
        if (li) load(parseInt(li.dataset.i, 10), true);
      });
      ui.list.addEventListener("keydown", (ev) => {
        if (ev.key !== "Enter" && ev.key !== " ") return;
        const li = ev.target.closest(".pl-item");
        if (li) { ev.preventDefault(); load(parseInt(li.dataset.i, 10), true); }
      });
    }

    /* ============================================================
       audio graph + visualizer
       ============================================================ */
    const viz = { actx: null, an: null, freq: null, raf: 0, p: 0 };

    function ensureGraph() {
      if (viz.actx) {
        if (viz.actx.state === "suspended") viz.actx.resume().catch(() => {});
        return;
      }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const actx = new AC();
        const src = actx.createMediaElementSource(audio);
        const an = actx.createAnalyser();
        an.fftSize = 256;
        an.smoothingTimeConstant = 0.82;
        src.connect(an);
        an.connect(actx.destination);
        viz.actx = actx;
        viz.an = an;
        viz.freq = new Uint8Array(an.frequencyBinCount);
      } catch (e) { viz.actx = null; }
    }

    function drawViz(ts) {
      const c = ui.viz;
      const ctx = viz.ctx2d;
      if (!c || !ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = c.clientWidth || 600;
      const h = 72;
      if (c.width !== w * dpr) { c.width = w * dpr; c.height = h * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const playing = window.MUSIC.playing && viz.an;

      if (playing) {
        viz.an.getByteFrequencyData(viz.freq);
        const bins = 64;
        const gap = 3;
        const bw = Math.max(2, (w - gap * (bins - 1)) / bins);
        let sum = 0;
        for (let i = 0; i < bins; i++) {
          const v = viz.freq[i * 2] / 255;
          sum += v;
          const bh = Math.max(2, v * (h - 8));
          const x = i * (bw + gap);
          const g = ctx.createLinearGradient(0, h - bh, 0, h);
          g.addColorStop(0, "#00e5ff");
          g.addColorStop(1, "#39ff88");
          ctx.fillStyle = g;
          ctx.shadowColor = "rgba(57,255,136,0.7)";
          ctx.shadowBlur = 6;
          ctx.fillRect(x, h - bh, bw, bh);
        }
        ctx.shadowBlur = 0;
        const rms = sum / bins;
        const target = Math.min(1, rms * 2.4);
        viz.p += (target - viz.p) * 0.2;
      } else {
        viz.p += (0 - viz.p) * 0.1;
        ctx.strokeStyle = "rgba(57,255,136,0.35)";
        ctx.lineWidth = 1.5;
        ctx.shadowColor = "rgba(57,255,136,0.4)";
        ctx.shadowBlur = 4;
        ctx.beginPath();
        const amp = 2 + viz.p * 6;
        for (let x = 0; x <= w; x += 4) {
          const y = h / 2 + Math.sin(x * 0.02 + (ts || 0) * 0.002) * amp;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      window.MUSIC.pulse = viz.p;
      if (!reduced) {
        document.documentElement.style.setProperty("--pulse", viz.p.toFixed(3));
      }
    }

    function drawLoop() {
      if (viz.raf) return;
      const step = (ts) => {
        if (document.hidden) { viz.raf = 0; return; }
        drawViz(ts);
        viz.raf = requestAnimationFrame(step);
      };
      viz.raf = requestAnimationFrame(step);
    }

    /* --- static viz (reduced motion) --- */
    function drawStatic() {
      const c = ui.viz;
      if (!c) return;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = c.clientWidth || 600;
      const h = 72;
      c.width = w * dpr; c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "rgba(57,255,136,0.45)";
      const bins = 64;
      const gap = 3;
      const bw = Math.max(2, (w - gap * (bins - 1)) / bins);
      for (let i = 0; i < bins; i++) {
        const bh = 4 + ((i * 37) % 11);
        ctx.fillRect(i * (bw + gap), h - bh, bw, bh);
      }
    }

    if (ui.viz) viz.ctx2d = ui.viz.getContext("2d");

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && !reduced) drawLoop();
    });

    /* ============================================================
           init
           ============================================================ */
    function emptyState() {
      if (ui.title) ui.title.textContent = "в папке " + DIR + "/ пока нет треков";
      if (ui.artist) ui.artist.textContent = "закинь .mp3 сюда: GitHub → репозиторий → Add file → Upload files";
      if (ui.count) ui.count.textContent = "0 трек.";
      setState(apiFailed ? "" : "led-off", apiFailed ? "н/д (api)" : "0 треков");
      [ui.play, ui.next, ui.prev].forEach((b) => { if (b) b.disabled = true; });
      if (ui.ph) ui.ph.textContent = "∅";
    }

    (async function init() {
      if (ui.play) ui.play.textContent = ">";
      tracks = await discover();
      if (!tracks.length) { emptyState(); if (reduced) drawStatic(); return; }
      renderList();
      load(0, false);
      setState("led-blink", "нажми ▶");
      if (reduced) drawStatic(); else drawLoop();
      hydrateAll();
    })();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", musicPlayer);
  } else {
    musicPlayer();
  }
})();
