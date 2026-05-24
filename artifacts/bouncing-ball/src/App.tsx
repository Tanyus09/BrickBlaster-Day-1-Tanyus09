import { useEffect, useRef, useState } from "react";

const RADIUS = 12;
const PADDLE_H = 14;
const PADDLE_SPEED = 8;
const PADDLE_Y_OFFSET = 36;
const BRICK_ROWS = 3;
const BRICK_COLS = 6;
const BRICK_H = 24;
const BRICK_GAP = 6;
const BRICK_TOP = 90;
const MAX_LIVES = 3;
const TRAIL_LEN = 10;

const BRICK_COLORS = ["#ff4466", "#ff7722", "#ffcc00", "#44dd88", "#4499ff", "#cc44ff"];

type Brick = { x: number; y: number; w: number; alive: boolean; color: string; hits: number; maxHits: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string; r: number };
type PowerUp = { x: number; y: number; vy: number; type: "wide" | "slow" | "life"; active: boolean };
type Star = { x: number; y: number; r: number; speed: number; alpha: number; twinkle: number };
type LeaderEntry = { name: string; score: number };

function loadLeaderboard(): LeaderEntry[] {
  try { return JSON.parse(localStorage.getItem("bb_leaderboard") ?? "[]"); }
  catch { return []; }
}
function saveLeaderboard(entries: LeaderEntry[]) {
  localStorage.setItem("bb_leaderboard", JSON.stringify(entries));
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onGameOverRef = useRef<((score: number) => void) | null>(null);
  const resumeRef = useRef<(() => void) | null>(null);
  const stopMusicRef = useRef<(() => void) | null>(null);
  const setMusicMutedRef = useRef<((m: boolean) => void) | null>(null);

  const [screen, setScreen] = useState<"game" | "enter-name" | "leaderboard">("game");
  const [musicMuted, setMusicMuted] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [nameInput, setNameInput] = useState("");
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>(loadLeaderboard);

  onGameOverRef.current = (score: number) => {
    setFinalScore(score);
    setScreen("enter-name");
  };

  function submitName() {
    const name = nameInput.trim() || "Anonymous";
    const entry: LeaderEntry = { name, score: finalScore };
    const updated = [...leaderboard, entry].sort((a, b) => b.score - a.score).slice(0, 8);
    saveLeaderboard(updated);
    setLeaderboard(updated);
    setNameInput("");
    setScreen("leaderboard");
  }

  function playAgain() {
    setScreen("game");
    resumeRef.current?.();
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const audioCtx = new AudioContext();
    function beep(freq: number, dur: number, vol = 0.15) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.type = "square";
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(vol, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
      osc.start(); osc.stop(audioCtx.currentTime + dur);
    }

    // --- Background music ---
    const BPM = 152;
    const S = 60 / BPM / 4; // sixteenth note duration

    // Melody (square): 32 sixteenth notes
    const MEL = [
      523, 659, 784, 659,  523, 440, 349, 440,
      523, 659, 784, 880,  784, 659, 523, 0,
      392, 523, 659, 523,  440, 349, 293, 349,
      392, 523, 659, 784,  659, 523, 392, 0,
    ];
    // Bass (triangle): one note per 2 sixteenth notes (16 total)
    const BASS = [
      131, 131, 175, 175,  220, 220, 175, 175,
      131, 131, 147, 147,  165, 165, 131, 131,
    ];

    let musicMutedFlag = false;
    let musicSchedulerTimer: ReturnType<typeof setTimeout> | null = null;
    let musicBeat = 0;
    let musicNextTime = 0;

    function scheduleMusNote(freq: number, time: number, dur: number, type: OscillatorType, vol: number) {
      if (freq === 0 || musicMutedFlag) return;
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.connect(g); g.connect(audioCtx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, time);
      g.gain.setValueAtTime(vol, time);
      g.gain.exponentialRampToValueAtTime(0.0001, time + dur * 0.85);
      osc.start(time); osc.stop(time + dur);
    }

    function musicScheduler() {
      while (musicNextTime < audioCtx.currentTime + 0.25) {
        const idx = musicBeat % MEL.length;
        scheduleMusNote(MEL[idx], musicNextTime, S * 0.82, "square", 0.045);
        if (musicBeat % 2 === 0) {
          const bi = (musicBeat / 2) % BASS.length;
          scheduleMusNote(BASS[bi], musicNextTime, S * 1.9, "triangle", 0.055);
        }
        // Subtle hi-hat on every beat
        if (musicBeat % 4 === 0 && !musicMutedFlag) {
          const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.04, audioCtx.sampleRate);
          const data = buf.getChannelData(0);
          for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
          const src = audioCtx.createBufferSource();
          const hg = audioCtx.createGain();
          const filt = audioCtx.createBiquadFilter();
          filt.type = "highpass"; filt.frequency.value = 8000;
          src.buffer = buf;
          src.connect(filt); filt.connect(hg); hg.connect(audioCtx.destination);
          hg.gain.setValueAtTime(0.025, musicNextTime);
          hg.gain.exponentialRampToValueAtTime(0.0001, musicNextTime + 0.04);
          src.start(musicNextTime);
        }
        musicNextTime += S;
        musicBeat++;
      }
      musicSchedulerTimer = setTimeout(musicScheduler, 60);
    }

    function startMusic() {
      if (musicSchedulerTimer) return;
      musicBeat = 0;
      musicNextTime = audioCtx.currentTime + 0.05;
      musicScheduler();
    }

    function stopMusic() {
      if (musicSchedulerTimer) { clearTimeout(musicSchedulerTimer); musicSchedulerTimer = null; }
    }

    stopMusicRef.current = stopMusic;
    setMusicMutedRef.current = (m: boolean) => { musicMutedFlag = m; };

    let animId: number;
    const keys: Record<string, boolean> = {};
    let highScore = parseInt(localStorage.getItem("bb_highscore") ?? "0", 10);

    // Stars
    const NUM_STARS = 120;
    let stars: Star[] = [];
    function initStars() {
      stars = Array.from({ length: NUM_STARS }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.5 + 0.3,
        speed: Math.random() * 0.3 + 0.05,
        alpha: Math.random() * 0.8 + 0.2,
        twinkle: Math.random() * Math.PI * 2,
      }));
    }

    // Game state
    let bx: number, by: number, bvx: number, bvy: number;
    let paddleX: number, paddleW: number;
    let score: number, lives: number, level: number;
    let gameOver: boolean, won: boolean, started: boolean;
    let showTitle = true;
    let titleAnim = 0;
    let bricks: Brick[];
    let particles: Particle[] = [];
    let powerUps: PowerUp[] = [];
    let trail: { x: number; y: number }[] = [];
    let widePaddleTimer = 0;
    let slowTimer = 0;
    let combo = 0;
    let comboTimer = 0;
    let comboFlash = 0;
    let timeLeft = 0;
    let waitingForRestart = false;

    resumeRef.current = () => {
      waitingForRestart = false;
      reset(1);
    };

    function levelRows() { return Math.min(6, BRICK_ROWS + Math.floor((level - 1) / 2)); }
    function levelCols() { return Math.min(9, BRICK_COLS + Math.floor((level - 1) / 3)); }

    function makeBricks() {
      bricks = [];
      const rows = levelRows();
      const cols = levelCols();
      const totalW = canvas.width - 40;
      const bw = (totalW - (cols - 1) * BRICK_GAP) / cols;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const maxHits = r < Math.ceil(level / 2) ? 2 : 1;
          bricks.push({
            x: 20 + c * (bw + BRICK_GAP),
            y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
            w: bw, alive: true,
            color: BRICK_COLORS[r % BRICK_COLORS.length],
            hits: 0, maxHits,
          });
        }
      }
    }

    function reset(newLevel = 1) {
      level = newLevel;
      score = newLevel === 1 ? 0 : score;
      lives = newLevel === 1 ? MAX_LIVES : lives;
      paddleW = Math.max(60, 110 - (level - 1) * 8);
      paddleX = canvas.width / 2 - paddleW / 2;
      bx = canvas.width / 2; by = canvas.height * 0.6;
      const spd = 5.0 + (level - 1) * 0.6;
      bvx = spd * (Math.random() > 0.5 ? 1 : -1); bvy = -spd;
      gameOver = false; won = false; started = false;
      particles = []; powerUps = []; trail = [];
      widePaddleTimer = 0; slowTimer = 0;
      combo = 0; comboTimer = 0; comboFlash = 0;
      timeLeft = Math.max(40, 90 - (level - 1) * 8) * 60;
      waitingForRestart = false;
      makeBricks();
    }

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initStars();
    }
    resize();
    reset(1);
    window.addEventListener("resize", () => { resize(); reset(level); });

    function onKeyDown(e: KeyboardEvent) {
      keys[e.key] = true;
      if (["ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
      if (e.key === " " || e.key === "Enter") {
        if (showTitle) { showTitle = false; startMusic(); return; }
        if (!started && !gameOver && !won && !waitingForRestart) started = true;
        else if (won) reset(level + 1);
      }
    }
    function onKeyUp(e: KeyboardEvent) { keys[e.key] = false; }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    function onTouchMove(e: TouchEvent) {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const tx = (touch.clientX - rect.left) * (canvas.width / rect.width);
      paddleX = Math.max(0, Math.min(canvas.width - paddleW, tx - paddleW / 2));
    }
    function onTouchStart(e: TouchEvent) {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const tx = (touch.clientX - rect.left) * (canvas.width / rect.width);
      paddleX = Math.max(0, Math.min(canvas.width - paddleW, tx - paddleW / 2));
      if (showTitle) { showTitle = false; startMusic(); return; }
      if (!started && !gameOver && !won && !waitingForRestart) started = true;
      else if (won) reset(level + 1);
    }
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });

    function spawnParticles(x: number, y: number, color: string, n = 14) {
      for (let i = 0; i < n; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = 1.5 + Math.random() * 4;
        particles.push({ x, y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd, life: 1, color, r: 2 + Math.random() * 4 });
      }
    }

    function drawStars() {
      for (const s of stars) {
        s.y += s.speed;
        s.twinkle += 0.04;
        if (s.y > canvas.height) { s.y = 0; s.x = Math.random() * canvas.width; }
        const a = s.alpha * (0.6 + 0.4 * Math.sin(s.twinkle));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fill();
      }
    }

    function drawBackground() {
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      grad.addColorStop(0, "#050510");
      grad.addColorStop(1, "#0a0a20");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawStars();
    }

    function drawTitleScreen() {
      titleAnim++;
      drawBackground();

      // Demo bricks in background (faded)
      const cols = 8, rows = 3;
      const bw = (canvas.width - 80) / cols;
      ctx.globalAlpha = 0.18 + 0.06 * Math.sin(titleAnim * 0.02);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const color = BRICK_COLORS[(r + c) % BRICK_COLORS.length];
          ctx.fillStyle = color;
          ctx.shadowColor = color; ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.roundRect(40 + c * (bw + 6), canvas.height * 0.15 + r * 30, bw, 22, 5);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;

      // Title glow rings
      const cx = canvas.width / 2;
      const cy = canvas.height * 0.38;
      for (let i = 3; i >= 1; i--) {
        ctx.beginPath();
        ctx.arc(cx, cy, 120 + i * 18 + 6 * Math.sin(titleAnim * 0.03), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(100,150,255,${0.04 * i})`;
        ctx.lineWidth = 20;
        ctx.stroke();
      }

      // Game title
      const pulse = 1 + 0.015 * Math.sin(titleAnim * 0.05);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(pulse, pulse);
      ctx.textAlign = "center";

      // Shadow/glow
      ctx.shadowColor = "#6688ff";
      ctx.shadowBlur = 60;
      ctx.font = "bold 72px system-ui, sans-serif";

      // Gradient text
      const tg = ctx.createLinearGradient(-200, -40, 200, 40);
      tg.addColorStop(0, "#ff66aa");
      tg.addColorStop(0.35, "#ffcc44");
      tg.addColorStop(0.65, "#44ffcc");
      tg.addColorStop(1, "#6688ff");
      ctx.fillStyle = tg;
      ctx.fillText("BRICK", 0, -10);

      ctx.font = "bold 48px system-ui, sans-serif";
      const tg2 = ctx.createLinearGradient(-150, 0, 150, 0);
      tg2.addColorStop(0, "#6688ff");
      tg2.addColorStop(0.5, "#44ffcc");
      tg2.addColorStop(1, "#ffcc44");
      ctx.fillStyle = tg2;
      ctx.fillText("B L A S T", 0, 46);
      ctx.shadowBlur = 0;
      ctx.restore();

      // Tagline
      ctx.textAlign = "center";
      ctx.font = "16px system-ui, sans-serif";
      ctx.fillStyle = "rgba(180,200,255,0.6)";
      ctx.fillText("Break every brick. Beat every level.", cx, canvas.height * 0.38 + 90);

      // Pulsing play button
      const btnY = canvas.height * 0.62;
      const btnW = 220, btnH = 54;
      const btnAlpha = 0.75 + 0.25 * Math.sin(titleAnim * 0.08);
      const btnGrad = ctx.createLinearGradient(cx - btnW / 2, 0, cx + btnW / 2, 0);
      btnGrad.addColorStop(0, `rgba(100,80,255,${btnAlpha})`);
      btnGrad.addColorStop(1, `rgba(255,80,160,${btnAlpha})`);
      ctx.shadowColor = "#aa66ff"; ctx.shadowBlur = 20 * btnAlpha;
      ctx.fillStyle = btnGrad;
      ctx.beginPath();
      ctx.roundRect(cx - btnW / 2, btnY - btnH / 2, btnW, btnH, 27);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.font = "bold 20px system-ui, sans-serif";
      ctx.fillStyle = "#fff";
      ctx.fillText("▶  PLAY NOW", cx, btnY + 7);

      // Controls hint
      ctx.font = "13px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillText("Arrow keys or touch to move  ·  Space / Tap to launch", cx, canvas.height * 0.78);

      // Best score
      if (highScore > 0) {
        ctx.font = "15px system-ui, sans-serif";
        ctx.fillStyle = "rgba(255,215,0,0.5)";
        ctx.fillText(`🏆 Best: ${highScore}`, cx, canvas.height * 0.84);
      }
    }

    function drawBrick(b: Brick) {
      const faded = b.hits > 0;
      const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + BRICK_H);
      const col = b.color;
      if (faded) {
        g.addColorStop(0, col + "55"); g.addColorStop(1, col + "33");
      } else {
        g.addColorStop(0, col + "ff"); g.addColorStop(1, col + "aa");
      }
      ctx.shadowColor = col; ctx.shadowBlur = faded ? 4 : 14;
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, BRICK_H, 5); ctx.fill();
      if (!faded) {
        ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      if (b.maxHits > 1 && b.hits === 0) {
        // Crack pattern for 2-hit bricks
        ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(b.x + b.w * 0.5, b.y + 3);
        ctx.lineTo(b.x + b.w * 0.48, b.y + BRICK_H - 3);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }

    function drawBricks() {
      for (const b of bricks) { if (b.alive) drawBrick(b); }
    }

    function drawParticles() {
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life -= 0.022;
        if (p.life <= 0) continue;
        ctx.globalAlpha = p.life;
        ctx.shadowColor = p.color; ctx.shadowBlur = 6;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      particles = particles.filter(p => p.life > 0);
    }

    function drawPowerUps() {
      for (const p of powerUps) {
        if (!p.active) continue;
        const emoji = p.type === "wide" ? "⬛" : p.type === "slow" ? "🐢" : "♥";
        const color = p.type === "wide" ? "#44ffcc" : p.type === "slow" ? "#aaaaff" : "#ff4466";
        ctx.shadowColor = color; ctx.shadowBlur = 16;
        const pg = ctx.createLinearGradient(p.x - 16, p.y, p.x + 16, p.y);
        pg.addColorStop(0, color + "cc"); pg.addColorStop(1, color + "88");
        ctx.fillStyle = pg;
        ctx.beginPath(); ctx.roundRect(p.x - 16, p.y - 12, 32, 24, 6); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.textAlign = "center"; ctx.font = "14px system-ui, sans-serif";
        ctx.fillStyle = "#000"; ctx.fillText(emoji, p.x, p.y + 5);
      }
    }

    function drawPaddle(px: number, pw: number, py: number) {
      const isWide = widePaddleTimer > 0;
      const pg = ctx.createLinearGradient(px, py, px + pw, py);
      if (isWide) {
        pg.addColorStop(0, "#44ffcc"); pg.addColorStop(0.5, "#88ffee"); pg.addColorStop(1, "#44ffcc");
      } else {
        pg.addColorStop(0, "#8888ff"); pg.addColorStop(0.5, "#ffffff"); pg.addColorStop(1, "#8888ff");
      }
      ctx.shadowColor = isWide ? "#44ffcc" : "#aaaaff"; ctx.shadowBlur = isWide ? 24 : 14;
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.roundRect(px, py - PADDLE_H / 2, pw, PADDLE_H, 7); ctx.fill();
      ctx.shadowBlur = 0;
    }

    function drawBall(x: number, y: number) {
      // Trail
      for (let i = 0; i < trail.length; i++) {
        const t = trail[i];
        const alpha = (i / trail.length) * 0.35;
        const r = RADIUS * (0.3 + 0.7 * i / trail.length);
        ctx.beginPath(); ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220,80,80,${alpha})`; ctx.fill();
      }
      // Main ball
      const grad = ctx.createRadialGradient(x - 4, y - 4, 1, x, y, RADIUS);
      grad.addColorStop(0, "#ffaaaa");
      grad.addColorStop(0.4, "#ff3344");
      grad.addColorStop(1, "#660011");
      ctx.shadowColor = "rgba(255,80,80,0.9)"; ctx.shadowBlur = 22;
      ctx.beginPath(); ctx.arc(x, y, RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = grad; ctx.fill();
      ctx.shadowBlur = 0;
      // Highlight
      ctx.beginPath(); ctx.arc(x - 4, y - 4, RADIUS / 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.fill();
    }

    function drawHUD() {
      // Score
      ctx.textAlign = "left";
      ctx.font = "bold 22px system-ui, sans-serif";
      const sg = ctx.createLinearGradient(20, 0, 120, 0);
      sg.addColorStop(0, "#ffffff"); sg.addColorStop(1, "#aaccff");
      ctx.fillStyle = sg;
      ctx.shadowColor = "#4488ff"; ctx.shadowBlur = 8;
      ctx.fillText(`${score}`, 20, 32);
      ctx.shadowBlur = 0;
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillStyle = "rgba(150,180,255,0.7)";
      ctx.fillText("SCORE", 20, 48);

      if (highScore > 0) {
        ctx.font = "13px system-ui, sans-serif";
        ctx.fillStyle = "rgba(255,215,0,0.65)";
        ctx.fillText(`🏆 ${highScore}`, 20, 66);
      }

      // Level (center)
      ctx.textAlign = "center";
      ctx.font = "bold 18px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText(`LEVEL ${level}`, canvas.width / 2, 30);

      // Timer
      const secs = Math.ceil(timeLeft / 60);
      const isLow = secs <= 15;
      ctx.font = `bold ${isLow ? "24px" : "18px"} system-ui, sans-serif`;
      if (isLow && secs <= 8) {
        ctx.fillStyle = "#ff3333"; ctx.shadowColor = "#ff0000"; ctx.shadowBlur = 16;
      } else if (isLow) {
        ctx.fillStyle = "#ffaa00"; ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = "rgba(200,220,255,0.7)"; ctx.shadowBlur = 0;
      }
      ctx.fillText(`⏱ ${secs}s`, canvas.width / 2, 54);
      ctx.shadowBlur = 0;

      // Lives (right)
      ctx.textAlign = "right";
      for (let i = 0; i < MAX_LIVES; i++) {
        const filled = i < lives;
        ctx.font = "22px system-ui, sans-serif";
        ctx.fillStyle = filled ? "#ff4488" : "rgba(255,68,136,0.2)";
        ctx.shadowColor = filled ? "#ff4488" : "transparent";
        ctx.shadowBlur = filled ? 10 : 0;
        ctx.fillText("♥", canvas.width - 20 - i * 28, 32);
      }
      ctx.shadowBlur = 0;

      // Combo
      if (combo >= 2 && comboFlash > 0) {
        const alpha = comboFlash / 40;
        const scale = 1 + (1 - alpha) * 0.4;
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height * 0.42);
        ctx.scale(scale, scale);
        ctx.textAlign = "center";
        ctx.font = `bold ${Math.min(52 + combo * 4, 76)}px system-ui, sans-serif`;
        const cg = ctx.createLinearGradient(-100, 0, 100, 0);
        cg.addColorStop(0, `rgba(255,200,0,${alpha})`);
        cg.addColorStop(0.5, `rgba(255,255,100,${alpha})`);
        cg.addColorStop(1, `rgba(255,160,0,${alpha})`);
        ctx.fillStyle = cg;
        ctx.shadowColor = `rgba(255,180,0,${alpha})`; ctx.shadowBlur = 30;
        ctx.fillText(`✦ ${combo}x COMBO! ✦`, 0, 0);
        ctx.shadowBlur = 0;
        ctx.restore();
      } else if (combo >= 2) {
        ctx.textAlign = "center";
        ctx.font = "bold 16px system-ui, sans-serif";
        ctx.fillStyle = "rgba(255,220,50,0.55)";
        ctx.fillText(`${combo}x combo`, canvas.width / 2, canvas.height * 0.4);
      }

      // Power-up timers
      let barY = canvas.height - 55;
      if (widePaddleTimer > 0) {
        ctx.textAlign = "left"; ctx.font = "13px system-ui, sans-serif";
        ctx.fillStyle = "#44ffcc";
        ctx.fillText(`⬛ Wide: ${Math.ceil(widePaddleTimer / 60)}s`, 18, barY); barY -= 22;
      }
      if (slowTimer > 0) {
        ctx.textAlign = "left"; ctx.font = "13px system-ui, sans-serif";
        ctx.fillStyle = "#aaaaff";
        ctx.fillText(`🐢 Slow: ${Math.ceil(slowTimer / 60)}s`, 18, barY);
      }
    }

    function drawWinOverlay() {
      ctx.fillStyle = "rgba(0,0,10,0.75)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.textAlign = "center";
      ctx.font = "bold 64px system-ui, sans-serif";
      const wg = ctx.createLinearGradient(canvas.width / 2 - 160, 0, canvas.width / 2 + 160, 0);
      wg.addColorStop(0, "#44ffcc"); wg.addColorStop(0.5, "#88ffee"); wg.addColorStop(1, "#44ffcc");
      ctx.fillStyle = wg;
      ctx.shadowColor = "#44ffcc"; ctx.shadowBlur = 40;
      ctx.fillText("LEVEL CLEAR! ✓", canvas.width / 2, canvas.height / 2 - 40);
      ctx.shadowBlur = 0;
      ctx.font = "24px system-ui, sans-serif"; ctx.fillStyle = "#fff";
      ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 + 16);
      ctx.font = "16px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.fillText("Press Space or Tap for next level", canvas.width / 2, canvas.height / 2 + 56);
    }

    function triggerGameOver() {
      gameOver = true; waitingForRestart = true;
      stopMusic();
      if (score > highScore) { highScore = score; localStorage.setItem("bb_highscore", String(highScore)); }
      setTimeout(() => onGameOverRef.current?.(score), 600);
    }

    function draw() {
      const paddleY = canvas.height - PADDLE_Y_OFFSET;

      if (showTitle) {
        drawTitleScreen();
        animId = requestAnimationFrame(draw);
        return;
      }

      drawBackground();

      if (waitingForRestart) {
        drawBricks(); drawParticles(); drawPaddle(paddleX, paddleW, paddleY); drawBall(bx, by); drawHUD();
        animId = requestAnimationFrame(draw); return;
      }
      if (won) { drawBricks(); drawPaddle(paddleX, paddleW, paddleY); drawBall(bx, by); drawHUD(); drawWinOverlay(); animId = requestAnimationFrame(draw); return; }

      if (widePaddleTimer > 0) { widePaddleTimer--; paddleW = 160; }
      else paddleW = Math.max(60, 110 - (level - 1) * 8);
      if (slowTimer > 0) slowTimer--;

      if (comboTimer > 0) comboTimer--;
      else if (combo > 0) combo = 0;
      if (comboFlash > 0) comboFlash--;

      if (started && timeLeft > 0) timeLeft--;
      if (timeLeft === 0 && started && !gameOver) triggerGameOver();

      if (!started) {
        drawBricks(); drawParticles(); drawPaddle(paddleX, paddleW, paddleY); drawBall(bx, by); drawHUD();
        // Launch hint
        ctx.textAlign = "center";
        ctx.font = "bold 20px system-ui, sans-serif";
        const pulse = 0.6 + 0.4 * Math.sin(Date.now() * 0.004);
        ctx.fillStyle = `rgba(255,255,255,${pulse})`;
        ctx.shadowColor = "#8899ff"; ctx.shadowBlur = 12;
        ctx.fillText("Tap or Press Space to Launch!", canvas.width / 2, canvas.height / 2 + 20);
        ctx.shadowBlur = 0;
        animId = requestAnimationFrame(draw); return;
      }

      if (keys["ArrowLeft"]) paddleX = Math.max(0, paddleX - PADDLE_SPEED);
      if (keys["ArrowRight"]) paddleX = Math.min(canvas.width - paddleW, paddleX + PADDLE_SPEED);

      const slowFactor = slowTimer > 0 ? 0.55 : 1;
      trail.push({ x: bx, y: by });
      if (trail.length > TRAIL_LEN) trail.shift();
      bx += bvx * slowFactor; by += bvy * slowFactor;

      if (bx - RADIUS <= 0) { bx = RADIUS; bvx = Math.abs(bvx); beep(280, 0.05); }
      else if (bx + RADIUS >= canvas.width) { bx = canvas.width - RADIUS; bvx = -Math.abs(bvx); beep(280, 0.05); }
      if (by - RADIUS <= 0) { by = RADIUS; bvy = Math.abs(bvy); beep(280, 0.05); }

      const phitsX = bx + RADIUS >= paddleX && bx - RADIUS <= paddleX + paddleW;
      const phitsY = by + RADIUS >= paddleY - PADDLE_H / 2 && by + RADIUS <= paddleY + PADDLE_H + 4;
      if (phitsX && phitsY && bvy > 0) {
        beep(520, 0.1);
        const hitPos = (bx - paddleX) / paddleW;
        bvx = (hitPos - 0.5) * 11;
        bvy = -Math.abs(bvy);
        by = paddleY - PADDLE_H / 2 - RADIUS;
        combo = 0; comboTimer = 0;
        score += 1;
        if (score > highScore) { highScore = score; localStorage.setItem("bb_highscore", String(highScore)); }
      }

      if (by - RADIUS > canvas.height) {
        lives--; beep(100, 0.5, 0.3); trail = [];
        if (lives <= 0) { triggerGameOver(); }
        else {
          bx = canvas.width / 2; by = canvas.height * 0.6;
          const spd = 5.0 + (level - 1) * 0.6;
          bvx = spd * (Math.random() > 0.5 ? 1 : -1); bvy = -spd;
          started = false;
        }
        animId = requestAnimationFrame(draw); return;
      }

      for (const b of bricks) {
        if (!b.alive) continue;
        const closestX = Math.max(b.x, Math.min(bx, b.x + b.w));
        const closestY = Math.max(b.y, Math.min(by, b.y + BRICK_H));
        const dx = bx - closestX, dy = by - closestY;
        if (dx * dx + dy * dy < RADIUS * RADIUS) {
          b.hits++;
          if (b.hits >= b.maxHits) {
            b.alive = false; combo++; comboTimer = 72; comboFlash = 40;
            const basePoints = b.maxHits === 2 ? 30 : 10;
            score += basePoints * combo;
            if (score > highScore) { highScore = score; localStorage.setItem("bb_highscore", String(highScore)); }
            spawnParticles(b.x + b.w / 2, b.y + BRICK_H / 2, b.color, 14);
            beep(600 + combo * 50, 0.1, 0.14);
            if (Math.random() < 0.2) {
              const types: PowerUp["type"][] = ["wide", "slow", "life"];
              powerUps.push({ x: b.x + b.w / 2, y: b.y + BRICK_H / 2, vy: 2, type: types[Math.floor(Math.random() * types.length)], active: true });
            }
          } else { beep(380, 0.07, 0.1); }
          if (Math.abs(dx) > Math.abs(dy)) bvx = -bvx; else bvy = -bvy;
          break;
        }
      }

      for (const p of powerUps) {
        if (!p.active) continue; p.y += p.vy;
        const inX = p.x >= paddleX && p.x <= paddleX + paddleW;
        const inY = p.y >= paddleY - 12 && p.y <= paddleY + 12;
        if (inX && inY) {
          p.active = false;
          if (p.type === "wide") { widePaddleTimer = 60 * 7; beep(880, 0.15); }
          else if (p.type === "slow") { slowTimer = 60 * 6; beep(330, 0.15); }
          else if (p.type === "life") { lives = Math.min(lives + 1, 5); beep(660, 0.2); }
        }
        if (p.y > canvas.height) p.active = false;
      }

      if (bricks.every(b => !b.alive)) { won = true; beep(880, 0.4); }

      drawBricks(); drawParticles(); drawPowerUps();
      drawPaddle(paddleX, paddleW, paddleY);
      drawBall(bx, by);
      drawHUD();

      animId = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animId);
      stopMusic();
      audioCtx.close();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchstart", onTouchStart);
    };
  }, []);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}>
      <canvas ref={canvasRef} style={{ display: "block" }} />

      {/* Mute button */}
      {screen === "game" && (
        <button
          onClick={() => {
            const next = !musicMuted;
            setMusicMuted(next);
            setMusicMutedRef.current?.(next);
          }}
          style={{
            position: "absolute", bottom: 16, right: 16,
            background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 10, padding: "8px 14px", cursor: "pointer",
            color: "rgba(255,255,255,0.7)", fontSize: 20, lineHeight: 1,
            backdropFilter: "blur(4px)",
          }}
          title={musicMuted ? "Unmute music" : "Mute music"}
        >
          {musicMuted ? "🔇" : "🔊"}
        </button>
      )}

      {screen === "enter-name" && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(ellipse at center, rgba(40,0,60,0.92) 0%, rgba(0,0,20,0.95) 100%)",
        }}>
          <div style={{
            background: "linear-gradient(135deg, #0e0e2a 0%, #1a0a2e 100%)",
            border: "1px solid rgba(150,100,255,0.3)",
            borderRadius: 20, padding: "44px 52px", textAlign: "center",
            boxShadow: "0 0 80px rgba(200,80,255,0.25), inset 0 0 40px rgba(100,50,200,0.1)",
            maxWidth: 380, width: "90%",
          }}>
            <div style={{ fontSize: 56, marginBottom: 8 }}>💀</div>
            <div style={{
              background: "linear-gradient(90deg, #ff4466, #ff8833)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              fontSize: 34, fontWeight: "bold", fontFamily: "system-ui", marginBottom: 6,
            }}>GAME OVER</div>
            <div style={{ color: "rgba(200,180,255,0.75)", fontFamily: "system-ui", fontSize: 18, marginBottom: 28 }}>
              Final Score: <span style={{ color: "#fff", fontWeight: "bold", fontSize: 22 }}>{finalScore}</span>
            </div>
            <div style={{ color: "rgba(180,160,255,0.6)", fontFamily: "system-ui", fontSize: 14, marginBottom: 10 }}>
              Enter your name for the leaderboard:
            </div>
            <input
              autoFocus value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submitName()}
              maxLength={16} placeholder="Your name"
              style={{
                width: "100%", boxSizing: "border-box", padding: "11px 16px",
                borderRadius: 10, border: "1px solid rgba(150,100,255,0.4)",
                background: "rgba(100,80,200,0.12)", color: "#fff",
                fontFamily: "system-ui", fontSize: 17, outline: "none",
                marginBottom: 16, textAlign: "center",
              }}
            />
            <button onClick={submitName} style={{
              width: "100%", padding: "13px",
              background: "linear-gradient(90deg, #6644ff, #cc44ff)",
              borderRadius: 10, border: "none", color: "#fff",
              fontFamily: "system-ui", fontSize: 17, fontWeight: "bold", cursor: "pointer",
              boxShadow: "0 4px 20px rgba(150,80,255,0.4)",
            }}>Save Score →</button>
          </div>
        </div>
      )}

      {screen === "leaderboard" && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(ellipse at center, rgba(0,20,60,0.92) 0%, rgba(0,0,20,0.95) 100%)",
        }}>
          <div style={{
            background: "linear-gradient(135deg, #080820 0%, #0a1030 100%)",
            border: "1px solid rgba(100,150,255,0.3)",
            borderRadius: 20, padding: "40px 52px", textAlign: "center",
            boxShadow: "0 0 80px rgba(80,150,255,0.2), inset 0 0 40px rgba(50,100,200,0.08)",
            maxWidth: 400, width: "90%",
          }}>
            <div style={{ fontSize: 40, marginBottom: 2 }}>🏆</div>
            <div style={{
              background: "linear-gradient(90deg, #ffcc00, #ffee88, #ffcc00)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              fontSize: 28, fontWeight: "bold", fontFamily: "system-ui", marginBottom: 22,
              letterSpacing: 2,
            }}>LEADERBOARD</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "system-ui", marginBottom: 28 }}>
              <thead>
                <tr style={{ color: "rgba(150,180,255,0.45)", fontSize: 11, letterSpacing: 1 }}>
                  <td style={{ padding: "4px 8px", textAlign: "left" }}>#</td>
                  <td style={{ padding: "4px 8px", textAlign: "left" }}>PLAYER</td>
                  <td style={{ padding: "4px 8px", textAlign: "right" }}>SCORE</td>
                </tr>
              </thead>
              <tbody>
                {leaderboard.length === 0 && (
                  <tr><td colSpan={3} style={{ color: "rgba(255,255,255,0.25)", padding: 16, fontSize: 14 }}>No scores yet!</td></tr>
                )}
                {leaderboard.map((e, i) => (
                  <tr key={i} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                    <td style={{
                      padding: "10px 8px", fontSize: 15, fontWeight: "bold",
                      color: i === 0 ? "#ffcc00" : i === 1 ? "#cccccc" : i === 2 ? "#cd7f32" : "rgba(180,180,255,0.5)",
                    }}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                    </td>
                    <td style={{ padding: "10px 8px", fontSize: 16, textAlign: "left", color: i < 3 ? "#fff" : "rgba(200,200,255,0.7)" }}>{e.name}</td>
                    <td style={{
                      padding: "10px 8px", fontSize: 17, fontWeight: "bold", textAlign: "right",
                      color: i === 0 ? "#ffcc00" : i === 1 ? "#cccccc" : i === 2 ? "#cd7f32" : "rgba(200,200,255,0.7)",
                    }}>{e.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={playAgain} style={{
              width: "100%", padding: "13px",
              background: "linear-gradient(90deg, #22cc66, #44ffaa)",
              borderRadius: 10, border: "none", color: "#001a0a",
              fontFamily: "system-ui", fontSize: 17, fontWeight: "bold", cursor: "pointer",
              boxShadow: "0 4px 20px rgba(50,200,100,0.35)",
            }}>▶ Play Again</button>
          </div>
        </div>
      )}
    </div>
  );
}
