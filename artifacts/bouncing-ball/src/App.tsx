import { useEffect, useRef } from "react";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let x = canvas.width / 2;
    let y = canvas.height / 2;
    let vx = 4;
    let vy = 3.5;
    const RADIUS = 30;

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    function draw() {
      if (!canvas || !ctx) return;

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

      x += vx;
      y += vy;

      if (x - RADIUS <= 0) { x = RADIUS; vx = Math.abs(vx); }
      else if (x + RADIUS >= canvas.width) { x = canvas.width - RADIUS; vx = -Math.abs(vx); }
      if (y - RADIUS <= 0) { y = RADIUS; vy = Math.abs(vy); }
      else if (y + RADIUS >= canvas.height) { y = canvas.height - RADIUS; vy = -Math.abs(vy); }

      animId = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", background: "#0f0f19" }}
    />
  );
}
