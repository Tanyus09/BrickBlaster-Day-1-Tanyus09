import { useEffect, useRef } from "react";

const RADIUS = 30;
const PADDLE_W = 120;
const PADDLE_H = 14;
const PADDLE_SPEED = 7;
const PADDLE_Y_OFFSET = 40;

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let x = 0;
    let y = 0;
    let vx = 4;
    let vy = 3.5;
    let paddleX = 0;
    let score = 0;
    let gameOver = false;
    const keys: Record<string, boolean> = {};

    function reset() {
      if (!canvas) return;
      x = canvas.width / 2;
      y = canvas.height / 2;
      vx = 4;
      vy = 3.5;
      paddleX = canvas.width / 2 - PADDLE_W / 2;
      score = 0;
      gameOver = false;
    }

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      if (paddleX === 0) paddleX = canvas.width / 2 - PADDLE_W / 2;
      if (x === 0) x = canvas.width / 2;
      if (y === 0) y = canvas.height / 2;
    }
    resize();
    window.addEventListener("resize", resize);

    function onKeyDown(e: KeyboardEvent) {
      keys[e.key] = true;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") e.preventDefault();
      if (e.key === " " || e.key === "Enter") {
        if (gameOver) reset();
      }
    }
    function onKeyUp(e: KeyboardEvent) { keys[e.key] = false; }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    function drawGameOver() {
      if (!canvas || !ctx) return;
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.textAlign = "center";

      ctx.font = "bold 64px system-ui, sans-serif";
      ctx.fillStyle = "#ff3333";
      ctx.shadowColor = "rgba(220,50,50,0.7)";
      ctx.shadowBlur = 30;
      ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 40);

      ctx.shadowBlur = 0;
      ctx.font = "28px system-ui, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(`Final Score: ${score}`, canvas.width / 2, canvas.height / 2 + 20);

      ctx.font = "20px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fillText("Press Space or Enter to play again", canvas.width / 2, canvas.height / 2 + 70);
    }

    function draw() {
      if (!canvas || !ctx) return;

      if (gameOver) {
        drawGameOver();
        animId = requestAnimationFrame(draw);
        return;
      }

      const paddleY = canvas.height - PADDLE_Y_OFFSET;

      if (keys["ArrowLeft"]) paddleX = Math.max(0, paddleX - PADDLE_SPEED);
      if (keys["ArrowRight"]) paddleX = Math.min(canvas.width - PADDLE_W, paddleX + PADDLE_SPEED);

      x += vx;
      y += vy;

      if (x - RADIUS <= 0) { x = RADIUS; vx = Math.abs(vx); }
      else if (x + RADIUS >= canvas.width) { x = canvas.width - RADIUS; vx = -Math.abs(vx); }
      if (y - RADIUS <= 0) { y = RADIUS; vy = Math.abs(vy); }

      const hitsPaddleX = x + RADIUS >= paddleX && x - RADIUS <= paddleX + PADDLE_W;
      const hitsPaddleY = y + RADIUS >= paddleY - PADDLE_H / 2 && y + RADIUS <= paddleY + PADDLE_H / 2 + 8;
      if (hitsPaddleX && hitsPaddleY && vy > 0) {
        score += 1;
        const speedMult = 1 + score * 0.04;
        const hitPos = (x - paddleX) / PADDLE_W;
        vx = (hitPos - 0.5) * 8 * speedMult;
        vy = -Math.abs(vy) * speedMult;
        y = paddleY - PADDLE_H / 2 - RADIUS;
      }

      if (y - RADIUS > canvas.height) {
        gameOver = true;
        animId = requestAnimationFrame(draw);
        return;
      }

      ctx.fillStyle = "#0f0f19";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const grad = ctx.createRadialGradient(x - 8, y - 8, 2, x, y, RADIUS);
      grad.addColorStop(0, "#ff6666");
      grad.addColorStop(0.4, "#dc3232");
      grad.addColorStop(1, "#7a0000");

      ctx.shadowColor = "rgba(220, 50, 50, 0.6)";
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.arc(x, y, RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(x - 10, y - 10, RADIUS / 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fill();

      const rx = PADDLE_W / 2;
      const ry = PADDLE_H / 2;
      ctx.shadowColor = "rgba(255,255,255,0.4)";
      ctx.shadowBlur = 12;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(paddleX + rx, paddleY, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.textAlign = "center";
      ctx.font = "bold 28px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText(`${score}`, canvas.width / 2, 48);

      animId = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", background: "#0f0f19" }}
    />
  );
}
