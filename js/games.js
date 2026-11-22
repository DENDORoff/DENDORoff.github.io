/* ============================================================
   DENDOR bio — игровые виджеты (змейка, 2048)
   Активация по клику, управление WASD/стрелки,
   рекорды в localStorage.
   ============================================================ */
(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const PREFIX = "bio:game:";
  const best = (name) => {
    try { return parseInt(localStorage.getItem(PREFIX + name) || "0", 10) || 0; } catch (e) { return 0; }
  };
  const saveBest = (name, v) => {
    try { localStorage.setItem(PREFIX + name, String(v)); } catch (e) { /* quota */ }
  };

  let activeGame = null;

  function activate(name) {
    if (activeGame === name) return;
    activeGame = name;
    $$("[data-game]").forEach((card) => {
      card.classList.toggle("game-active", card.dataset.game === name);
    });
    $$(".game-wrap").forEach((w) => { w.style.filter = "grayscale(0.6) opacity(0.55)"; });
    const wrap = $("#" + name + "-wrap");
    if (wrap) wrap.style.filter = "none";
    $$(".w-status").forEach((s) => {
      s.textContent = s.id === name + "-state" ? "активно — WASD / стрелки" : "нажми, чтобы активировать";
    });
  }

  $$("[data-game]").forEach((card) => {
    card.addEventListener("click", () => activate(card.dataset.game));
  });

  document.addEventListener("keydown", (ev) => {
    if (!activeGame) return;
    const key = ev.key;
    const map = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
                w: "up", W: "up", s: "down", S: "down", a: "left", A: "left", d: "right", D: "right" };
    const dir = map[key];
    if (!dir) return;
    if (activeGame === "snake") { ev.preventDefault(); snakeSetDir(dir); }
    else if (activeGame === "2048") { ev.preventDefault(); game2048Move(dir); }
  });

  /* ============================================================
     ЗМЕЙКА
     ============================================================ */
  const snakeCanvas = $("#snake-canvas");
  const snakeScoreEl = $("#snake-score");
  const snakeBestEl = $("#snake-best");
  const snakeCtx = snakeCanvas ? snakeCanvas.getContext("2d") : null;
  let snake = [], food = {}, dir = "right", nextDir = "right", score = 0, snakeRunning = false, snakeTimer = null;
  const GS = 20; // grid size
  const COLS = 13, ROWS = 13;

  function snakeInit() {
    score = 0;
    snake = [{ x: 6, y: 6 }, { x: 5, y: 6 }, { x: 4, y: 6 }];
    dir = "right"; nextDir = "right";
    placeFood();
    if (snakeScoreEl) snakeScoreEl.textContent = "0";
    if (snakeBestEl) snakeBestEl.textContent = best("snake");
    snakeRunning = true;
    if (snakeTimer) clearInterval(snakeTimer);
    snakeTimer = setInterval(snakeTick, 220);
    drawSnake();
  }

  function placeFood() {
    food = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    for (const s of snake) if (s.x === food.x && s.y === food.y) { placeFood(); return; }
  }

  function snakeSetDir(d) {
    const opposites = { up: "down", down: "up", left: "right", right: "left" };
    if (opposites[d] !== dir) nextDir = d;
  }

  function snakeTick() {
    if (!snakeRunning) return;
    dir = nextDir;
    const head = { x: snake[0].x, y: snake[0].y };
    if (dir === "up") head.y--;
    else if (dir === "down") head.y++;
    else if (dir === "left") head.x--;
    else head.x++;

    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) { snakeGameOver(); return; }
    for (const s of snake) if (s.x === head.x && s.y === head.y) { snakeGameOver(); return; }

    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score += 10;
      if (snakeScoreEl) snakeScoreEl.textContent = String(score);
      placeFood();
    } else {
      snake.pop();
    }
    drawSnake();
  }

  function drawSnake() {
    if (!snakeCtx) return;
    snakeCtx.fillStyle = "#050608";
    snakeCtx.fillRect(0, 0, snakeCanvas.width, snakeCanvas.height);
    snakeCtx.fillStyle = "#39ff88";
    for (const s of snake) snakeCtx.fillRect(s.x * GS, s.y * GS, GS - 1, GS - 1);
    snakeCtx.fillStyle = "#ff2ea6";
    snakeCtx.fillRect(food.x * GS, food.y * GS, GS - 1, GS - 1);
    snakeCtx.strokeStyle = "rgba(57,255,136,0.2)";
    for (let i = 0; i <= COLS; i++) {
      snakeCtx.beginPath();
      snakeCtx.moveTo(i * GS, 0);
      snakeCtx.lineTo(i * GS, snakeCanvas.height);
      snakeCtx.stroke();
    }
    for (let i = 0; i <= ROWS; i++) {
      snakeCtx.beginPath();
      snakeCtx.moveTo(0, i * GS);
      snakeCtx.lineTo(snakeCanvas.width, i * GS);
      snakeCtx.stroke();
    }
  }

  function snakeGameOver() {
    snakeRunning = false;
    if (snakeTimer) clearInterval(snakeTimer);
    saveBest("snake", Math.max(best("snake"), score));
    if (snakeBestEl) snakeBestEl.textContent = best("snake");
    if ($("#snake-state")) $("#snake-state").textContent = "игра окончена — клик, чтобы рестарт";
  }

  /* ============================================================
     2048
     ============================================================ */
  const g2048Grid = $("#game2048-grid");
  const g2048ScoreEl = $("#game2048-score");
  const g2048BestEl = $("#game2048-best");
  let g2048 = [], g2048Score = 0, g2048Running = false;

  function g2048Init() {
    g2048 = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
    g2048Score = 0;
    g2048Running = true;
    if (g2048ScoreEl) g2048ScoreEl.textContent = "0";
    if (g2048BestEl) g2048BestEl.textContent = best("2048");
    g2048AddTile(); g2048AddTile();
    render2048();
  }

  function g2048AddTile() {
    const empties = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (!g2048[r][c]) empties.push({ r, c });
    if (!empties.length) return;
    const t = empties[Math.floor(Math.random() * empties.length)];
    g2048[t.r][t.c] = Math.random() < 0.9 ? 2 : 4;
  }

  function g2048Move(dir) {
    if (!g2048Running) return;
    let moved = false;
    const before = JSON.stringify(g2048);

    for (let r = 0; r < 4; r++) {
      let row = g2048[r].filter((v) => v !== 0);
      if (dir === "left") {
        for (let i = 0; i < row.length - 1; i++) {
          if (row[i] === row[i + 1]) { row[i] *= 2; g2048Score += row[i]; row[i + 1] = 0; }
        }
        row = row.filter((v) => v !== 0);
      } else if (dir === "right") {
        row.reverse();
        for (let i = 0; i < row.length - 1; i++) {
          if (row[i] === row[i + 1]) { row[i] *= 2; g2048Score += row[i]; row[i + 1] = 0; }
        }
        row = row.filter((v) => v !== 0);
        row.reverse();
      }
      while (row.length < 4) row.push(0);
      g2048[r] = row;
    }

    if (dir === "up" || dir === "down") {
      const tmp = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
      for (let c = 0; c < 4; c++) {
        let col = [];
        for (let r = 0; r < 4; r++) if (g2048[r][c]) col.push(g2048[r][c]);
        if (dir === "up") {
          for (let i = 0; i < col.length - 1; i++) {
            if (col[i] === col[i + 1]) { col[i] *= 2; g2048Score += col[i]; col[i + 1] = 0; }
          }
          col = col.filter((v) => v !== 0);
        } else {
          col.reverse();
          for (let i = 0; i < col.length - 1; i++) {
            if (col[i] === col[i + 1]) { col[i] *= 2; g2048Score += col[i]; col[i + 1] = 0; }
          }
          col = col.filter((v) => v !== 0);
          col.reverse();
        }
        while (col.length < 4) col.push(0);
        for (let r = 0; r < 4; r++) tmp[r][c] = col[r];
      }
      g2048 = tmp;
    }

    if (JSON.stringify(g2048) !== before) {
      moved = true;
      g2048AddTile();
      if (g2048ScoreEl) g2048ScoreEl.textContent = String(g2048Score);
      render2048();
      if (!g2048CanMove()) { g2048Running = false; if ($("#game2048-state")) $("#game2048-state").textContent = "игра окончена — клик, чтобы рестарт"; saveBest("2048", Math.max(best("2048"), g2048Score)); if (g2048BestEl) g2048BestEl.textContent = best("2048"); }
    }
  }

  function g2048CanMove() {
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      if (!g2048[r][c]) return true;
      if (c < 3 && g2048[r][c] === g2048[r][c + 1]) return true;
      if (r < 3 && g2048[r][c] === g2048[r + 1][c]) return true;
    }
    return false;
  }

  function render2048() {
    if (!g2048Grid) return;
    g2048Grid.innerHTML = "";
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const v = g2048[r][c];
        const cell = document.createElement("div");
        cell.className = "game2048-cell" + (v ? " v" + v : "");
        cell.textContent = v || "";
        g2048Grid.appendChild(cell);
      }
    }
  }

  /* сброс рекордов */
  $("#snake-reset").addEventListener("click", () => { saveBest("snake", 0); if (snakeBestEl) snakeBestEl.textContent = "0"; });
  $("#game2048-reset").addEventListener("click", () => { saveBest("2048", 0); if (g2048BestEl) g2048BestEl.textContent = "0"; });

  /* init по клику (лениво) */
  const started = { snake: false, "2048": false };
  document.addEventListener("click", (ev) => {
    const card = ev.target.closest("[data-game]");
    if (!card) return;
    const name = card.dataset.game;
    if (!started[name]) {
      started[name] = true;
      if (name === "snake") snakeInit();
      else if (name === "2048") g2048Init();
    }
  });
})();
