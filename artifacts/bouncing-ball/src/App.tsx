import { useEffect, useRef } from "react";

const RADIUS = 12;
const PADDLE_H = 12;
const PADDLE_SPEED = 7;
const PADDLE_Y_OFFSET = 36;
const BRICK_ROWS = 5;
const BRICK_COLS = 10;
const BRICK_H = 22;
const BRICK_GAP = 5;
const BRICK_TOP = 80;
const MAX_LIVES = 3;

const BRICK_COLORS = [
  "#ff4444", "#ff7700", "#ffcc00", "#44cc44", "#4488ff",
];

type Brick = { x: number; y: number; w: number; alive: boolean; color: string; hits: number; maxHits: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string; r: number };
type PowerUp = { x: number; y: number; vy: number; type: "wide" | "slow" | "life"; active: boolean };

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const audioCtx = new AudioContext();

    function beep(freq: number, dur: number, vol = 0.18) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.type = "square";
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(vol, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
      osc.start(); osc.stop(audioCtx.currentTime + dur);
    }

    let animId: number;
    const keys: Record<string, boolean> = {};
    let highScore = parseInt(localStorage.getItem("bb_highscore") ?? "0", 10);

    // --- Game state ---
    let bx: number, by: number, bvx: number, bvy: number;
    let paddleX: number, paddleW: number;
    let score: number, lives: number, level: number;
    let gameOver: boolean, won: boolean, started: boolean;
    let bricks: Brick[];
    let particles: Particle[] = [];
    let powerUps: PowerUp[] = [];
    let widePaddleTimer = 0;
    let slowTimer = 0;
    let combo = 0;
    let comboTimer = 0;
    let comboFlash = 0;
    let timeLeft = 0;

    function makeBricks() {
      bricks = [];
      const totalW = canvas.width - 40;
      const bw = (totalW - (BRICK_COLS - 1) * BRICK_GAP) / BRICK_COLS;
      for (let r = 0; r < BRICK_ROWS; r++) {
        for (let c = 0; c < BRICK_COLS; c++) {
          const maxHits = r === 0 ? 2 : 1;
          bricks.push({
            x: 20 + c * (bw + BRICK_GAP),
            y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
            w: bw,
            alive: true,
            color: BRICK_COLORS[r % BRICK_COLORS.length],
            hits: 0,
            maxHits,
          });
        }
      }
    }

    function reset(newLevel = 1) {
      level = newLevel;
      score = newLevel === 1 ? 0 : score;
      lives = newLevel === 1 ? MAX_LIVES : lives;
      paddleW = 110;
      paddleX = canvas.width / 2 - paddleW / 2;
      bx = canvas.width / 2;
      by = canvas.height * 0.6;
      const spd = 3.8 + (level - 1) * 0.5;
      bvx = spd * (Math.random() > 0.5 ? 1 : -1);
      bvy = -spd;
      gameOver = false;
      won = false;
      started = false;
      particles = [];
      powerUps = [];
      widePaddleTimer = 0;
      slowTimer = 0;
      combo = 0;
      comboTimer = 0;
      comboFlash = 0;
      timeLeft = 90 * 60;
      makeBricks();
    }

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    reset(1);
    window.addEventListener("resize", () => { resize(); reset(level); });

    function onKeyDown(e: KeyboardEvent) {
      keys[e.key] = true;
      if (["ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
      if (e.key === " " || e.key === "Enter") {
        if (!started && !gameOver && !won) started = true;
        else if (gameOver) reset(1);
        else if (won) reset(level + 1);
      }
    }
    function onKeyUp(e: KeyboardEvent) { keys[e.key] = false; }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    function spawnParticles(x: number, y: number, color: string, n = 10) {
      for (let i = 0; i < n; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = 1.5 + Math.random() * 3;
        particles.push({ x, y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd, life: 1, color, r: 2 + Math.random() * 3 });
      }
    }

    function drawHUD() {
      // Score
      ctx.textAlign = "left";
      ctx.font = "bold 20px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillText(`Score: ${score}`, 20, 30);

      // High score
      if (highScore > 0) {
        ctx.font = "14px system-ui, sans-serif";
        ctx.fillStyle = "rgba(255,215,0,0.7)";
        ctx.fillText(`Best: ${highScore}`, 20, 52);
      }

      // Level
      ctx.textAlign = "center";
      ctx.font = "bold 20px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillText(`Level ${level}`, canvas.width / 2, 30);

      // Timer
      const secs = Math.ceil(timeLeft / 60);
      const isLow = secs <= 15;
      ctx.font = `bold ${isLow ? "26px" : "20px"} system-ui, sans-serif`;
      ctx.fillStyle = isLow ? (secs <= 8 ? "#ff3333" : "#ffaa00") : "rgba(255,255,255,0.75)";
      if (isLow && secs <= 8) {
        ctx.shadowColor = "#ff3333";
        ctx.shadowBlur = 14;
      }
      ctx.fillText(`⏱ ${secs}s`, canvas.width / 2, 56);
      ctx.shadowBlur = 0;

      // Lives as hearts
      ctx.textAlign = "right";
      ctx.font = "20px system-ui, sans-serif";
      let hearts = "";
      for (let i = 0; i < lives; i++) hearts += "♥ ";
      ctx.fillStyle = "#ff4466";
      ctx.fillText(hearts.trim(), canvas.width - 20, 30);

      // Combo display
      if (combo >= 2 && comboFlash > 0) {
        const alpha = comboFlash / 40;
        const scale = 1 + (1 - alpha) * 0.3;
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2 - 60);
        ctx.scale(scale, scale);
        ctx.textAlign = "center";
        ctx.font = `bold ${Math.min(48 + combo * 4, 72)}px system-ui, sans-serif`;
        ctx.fillStyle = `rgba(255, 220, 50, ${alpha})`;
        ctx.shadowColor = `rgba(255,180,0,${alpha})`;
        ctx.shadowBlur = 20;
        ctx.fillText(`✦ ${combo}x COMBO! ✦`, 0, 0);
        ctx.shadowBlur = 0;
        ctx.restore();
      } else if (combo >= 2) {
        ctx.textAlign = "center";
        ctx.font = "bold 18px system-ui, sans-serif";
        ctx.fillStyle = "rgba(255,220,50,0.6)";
        ctx.fillText(`${combo}x combo`, canvas.width / 2, canvas.height / 2 - 40);
      }

      // Power-up timers
      let barY = canvas.height - 60;
      if (widePaddleTimer > 0) {
        ctx.textAlign = "left";
        ctx.font = "13px system-ui, sans-serif";
        ctx.fillStyle = "#44ffcc";
        ctx.fillText(`⬛ Wide Paddle: ${Math.ceil(widePaddleTimer / 60)}s`, 20, barY);
        barY -= 20;
      }
      if (slowTimer > 0) {
        ctx.textAlign = "left";
        ctx.font = "13px system-ui, sans-serif";
        ctx.fillStyle = "#aaaaff";
        ctx.fillText(`🐢 Slow Ball: ${Math.ceil(slowTimer / 60)}s`, 20, barY);
      }
    }

    function drawOverlay(title: string, sub: string, hint: string) {
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.textAlign = "center";
      ctx.font = "bold 60px system-ui, sans-serif";
      ctx.fillStyle = title === "YOU WIN!" ? "#44ffcc" : "#ff3333";
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 30;
      ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 50);
      ctx.shadowBlur = 0;
      ctx.font = "26px system-ui, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(sub, canvas.width / 2, canvas.height / 2 + 10);
      ctx.font = "18px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillText(hint, canvas.width / 2, canvas.height / 2 + 55);
    }

    function draw() {
      const paddleY = canvas.height - PADDLE_Y_OFFSET;

      // Background
      ctx.fillStyle = "#0d0d1a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Subtle grid
      ctx.strokeStyle = "rgba(255,255,255,0.03)";
      ctx.lineWidth = 1;
      for (let gx = 0; gx < canvas.width; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, canvas.height); ctx.stroke(); }
      for (let gy = 0; gy < canvas.height; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(canvas.width, gy); ctx.stroke(); }

      if (gameOver) { drawHUD(); drawOverlay("GAME OVER", `Score: ${score}`, "Press Space to play again"); animId = requestAnimationFrame(draw); return; }
      if (won) { drawHUD(); drawOverlay("YOU WIN!", `Score: ${score}  Level ${level}`, "Press Space for next level"); animId = requestAnimationFrame(draw); return; }

      // Power-up countdown
      if (widePaddleTimer > 0) { widePaddleTimer--; paddleW = 160; }
      else paddleW = 100 + (level - 1) * -5;
      if (slowTimer > 0) slowTimer--;

      // Combo countdown — expires after ~1.2 seconds without a brick break
      if (comboTimer > 0) comboTimer--;
      else if (combo > 0) combo = 0;
      if (comboFlash > 0) comboFlash--;

      // Timer countdown (only while ball is in play)
      if (started && timeLeft > 0) timeLeft--;
      if (timeLeft === 0 && started) { gameOver = true; }

      if (!started) {
        // Draw everything static then show hint
        drawBricks(); drawParticles(); drawPaddle(paddleX, paddleW, paddleY); drawBall(bx, by); drawHUD();
        ctx.textAlign = "center";
        ctx.font = "bold 22px system-ui, sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.fillText("Press Space to Launch!", canvas.width / 2, canvas.height / 2);
        animId = requestAnimationFrame(draw);
        return;
      }

      // Move paddle
      if (keys["ArrowLeft"]) paddleX = Math.max(0, paddleX - PADDLE_SPEED);
      if (keys["ArrowRight"]) paddleX = Math.min(canvas.width - paddleW, paddleX + PADDLE_SPEED);

      // Move ball
      const slowFactor = slowTimer > 0 ? 0.55 : 1;
      bx += bvx * slowFactor;
      by += bvy * slowFactor;

      // Wall bounces
      if (bx - RADIUS <= 0) { bx = RADIUS; bvx = Math.abs(bvx); beep(300, 0.05); }
      else if (bx + RADIUS >= canvas.width) { bx = canvas.width - RADIUS; bvx = -Math.abs(bvx); beep(300, 0.05); }
      if (by - RADIUS <= 0) { by = RADIUS; bvy = Math.abs(bvy); beep(300, 0.05); }

      // Paddle collision
      const phitsX = bx + RADIUS >= paddleX && bx - RADIUS <= paddleX + paddleW;
      const phitsY = by + RADIUS >= paddleY - PADDLE_H / 2 && by + RADIUS <= paddleY + PADDLE_H + 4;
      if (phitsX && phitsY && bvy > 0) {
        beep(480, 0.12);
        const hitPos = (bx - paddleX) / paddleW;
        bvx = (hitPos - 0.5) * 10;
        bvy = -Math.abs(bvy);
        by = paddleY - PADDLE_H / 2 - RADIUS;
        combo = 0; comboTimer = 0;
        score += 1;
        if (score > highScore) { highScore = score; localStorage.setItem("bb_highscore", String(highScore)); }
      }

      // Ball lost
      if (by - RADIUS > canvas.height) {
        lives--;
        beep(120, 0.4, 0.3);
        if (lives <= 0) { gameOver = true; }
        else {
          bx = canvas.width / 2; by = canvas.height * 0.6;
          const spd = 3.8 + (level - 1) * 0.5;
          bvx = spd * (Math.random() > 0.5 ? 1 : -1); bvy = -spd;
          started = false;
        }
        animId = requestAnimationFrame(draw); return;
      }

      // Brick collisions
      for (const b of bricks) {
        if (!b.alive) continue;
        const closestX = Math.max(b.x, Math.min(bx, b.x + b.w));
        const closestY = Math.max(b.y, Math.min(by, b.y + BRICK_H));
        const dx = bx - closestX, dy = by - closestY;
        if (dx * dx + dy * dy < RADIUS * RADIUS) {
          b.hits++;
          if (b.hits >= b.maxHits) {
            b.alive = false;
            combo++;
            comboTimer = 72;
            comboFlash = 40;
            const basePoints = b.maxHits === 2 ? 30 : 10;
            score += basePoints * combo;
            if (score > highScore) { highScore = score; localStorage.setItem("bb_highscore", String(highScore)); }
            spawnParticles(b.x + b.w / 2, b.y + BRICK_H / 2, b.color, 12);
            beep(600 + combo * 40, 0.1, 0.15);
            // 20% chance to drop power-up
            if (Math.random() < 0.2) {
              const types: PowerUp["type"][] = ["wide", "slow", "life"];
              powerUps.push({ x: b.x + b.w / 2, y: b.y + BRICK_H / 2, vy: 2, type: types[Math.floor(Math.random() * types.length)], active: true });
            }
          } else {
            beep(400, 0.08, 0.12);
          }
          // Reflect off nearest axis
          if (Math.abs(dx) > Math.abs(dy)) bvx = -bvx;
          else bvy = -bvy;
          break;
        }
      }

      // Power-up movement & collection
      for (const p of powerUps) {
        if (!p.active) continue;
        p.y += p.vy;
        const inX = p.x >= paddleX && p.x <= paddleX + paddleW;
        const inY = p.y >= paddleY - 10 && p.y <= paddleY + 10;
        if (inX && inY) {
          p.active = false;
          if (p.type === "wide") { widePaddleTimer = 60 * 7; beep(880, 0.15); }
          else if (p.type === "slow") { slowTimer = 60 * 6; beep(330, 0.15); }
          else if (p.type === "life") { lives = Math.min(lives + 1, 5); beep(660, 0.2); }
        }
        if (p.y > canvas.height) p.active = false;
      }

      // Check win
      if (bricks.every(b => !b.alive)) { won = true; beep(880, 0.3); }

      // Draw everything
      drawBricks();
      drawParticles();
      drawPowerUps();
      drawPaddle(paddleX, paddleW, paddleY);
      drawBall(bx, by);
      drawHUD();

      animId = requestAnimationFrame(draw);
    }

    function drawBricks() {
      for (const b of bricks) {
        if (!b.alive) continue;
        const faded = b.hits > 0;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = faded ? 4 : 10;
        ctx.fillStyle = faded ? b.color + "88" : b.color;
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, b.w, BRICK_H, 4);
        ctx.fill();
        if (b.maxHits > 1 && b.hits === 0) {
          ctx.strokeStyle = "rgba(255,255,255,0.35)";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
      }
    }

    function drawParticles() {
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.life -= 0.025;
        if (p.life <= 0) continue;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      particles = particles.filter(p => p.life > 0);
    }

    function drawPowerUps() {
      for (const p of powerUps) {
        if (!p.active) continue;
        const emoji = p.type === "wide" ? "⬛" : p.type === "slow" ? "🐢" : "♥";
        const color = p.type === "wide" ? "#44ffcc" : p.type === "slow" ? "#aaaaff" : "#ff4466";
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(p.x - 14, p.y - 10, 28, 20, 4);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.textAlign = "center";
        ctx.font = "13px system-ui, sans-serif";
        ctx.fillStyle = "#000";
        ctx.fillText(emoji, p.x, p.y + 5);
      }
    }

    function drawPaddle(px: number, pw: number, py: number) {
      const isWide = widePaddleTimer > 0;
      ctx.shadowColor = isWide ? "#44ffcc" : "rgba(255,255,255,0.5)";
      ctx.shadowBlur = isWide ? 18 : 10;
      ctx.fillStyle = isWide ? "#44ffcc" : "#ffffff";
      ctx.beginPath();
      ctx.roundRect(px, py - PADDLE_H / 2, pw, PADDLE_H, 6);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    function drawBall(x: number, y: number) {
      const grad = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, RADIUS);
      grad.addColorStop(0, "#ff8888");
      grad.addColorStop(0.5, "#dc3232");
      grad.addColorStop(1, "#7a0000");
      ctx.shadowColor = "rgba(220,50,50,0.7)";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(x, y, RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(x - 4, y - 4, RADIUS / 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fill();
    }

    draw();

    return () => {
      cancelAnimationFrame(animId);
      audioCtx.close();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  return <canvas ref={canvasRef} style={{ display: "block", background: "#0d0d1a" }} />;
}
