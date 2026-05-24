import http.server
import os

PORT = int(os.environ.get("PORT", 3000))

HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Bouncing Ball</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0f0f19; display: flex; align-items: center; justify-content: center; height: 100vh; }
    canvas { display: block; border-radius: 8px; box-shadow: 0 0 40px rgba(220,50,50,0.3); }
  </style>
</head>
<body>
  <canvas id="c" width="800" height="600"></canvas>
  <script>
    const canvas = document.getElementById("c");
    const ctx = canvas.getContext("2d");

    const RADIUS = 30;
    let x = canvas.width / 2;
    let y = canvas.height / 2;
    let vx = 4;
    let vy = 3.5;

    function draw() {
      ctx.fillStyle = "#0f0f19";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Shadow glow
      ctx.shadowColor = "rgba(220, 50, 50, 0.6)";
      ctx.shadowBlur = 20;

      // Ball body
      const grad = ctx.createRadialGradient(x - 8, y - 8, 2, x, y, RADIUS);
      grad.addColorStop(0, "#ff6666");
      grad.addColorStop(0.4, "#dc3232");
      grad.addColorStop(1, "#7a0000");
      ctx.beginPath();
      ctx.arc(x, y, RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Highlight
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(x - 10, y - 10, RADIUS / 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fill();

      // Move
      x += vx;
      y += vy;

      if (x - RADIUS <= 0) { x = RADIUS; vx = Math.abs(vx); }
      else if (x + RADIUS >= canvas.width) { x = canvas.width - RADIUS; vx = -Math.abs(vx); }

      if (y - RADIUS <= 0) { y = RADIUS; vy = Math.abs(vy); }
      else if (y + RADIUS >= canvas.height) { y = canvas.height - RADIUS; vy = -Math.abs(vy); }

      requestAnimationFrame(draw);
    }

    draw();
  </script>
</body>
</html>
"""

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-type", "text/html")
        self.end_headers()
        self.wfile.write(HTML.encode())

    def log_message(self, format, *args):
        pass

print(f"Bouncing Ball running on port {PORT}")
with http.server.HTTPServer(("0.0.0.0", PORT), Handler) as server:
    server.serve_forever()
