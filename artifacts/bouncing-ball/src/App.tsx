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
    const keys: Record<string, boolean> = {};

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

    const onKey = (e: KeyboardEvent, down: boolean) => {
      keys[e.key] = down;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") e.preventDefault();
    };
    window.addEventListener("keydown", (e) => onKey(e, true));
    window.addEventListener("keyup", (e) => onKey(e, false));

    function draw() {
      if (!canvas || !ctx) return;

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
        vy = -Math.abs(vy);
        y = paddleY - PADDLE_H / 2 - RADIUS;
        const hitPos = (x - paddleX) / PADDLE_W;
        vx = (hitPos - 0.5) * 8;
      }

      if (y - RADIUS > canvas.height) {
        y = canvas.height / 2;
        x = canvas.width / 2;
        vx = 4;
        vy = 3.5;
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

      animId = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", (e) => onKey(e, true));
      window.removeEventListener("keyup", (e) => onKey(e, false));
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", background: "#0f0f19" }}
    />
  );
}
