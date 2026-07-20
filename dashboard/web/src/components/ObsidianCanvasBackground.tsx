import { useEffect, useRef } from "react";

export function ObsidianCanvasBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    let mouseX = width / 2;
    let mouseY = height / 3;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("resize", handleResize);

    let tick = 0;

    const render = () => {
      tick += 0.015;

      // Base background - Deep Slate Obsidian
      ctx.fillStyle = "#070b14";
      ctx.fillRect(0, 0, width, height);

      // Hero Spotlight Gradient (Top Center)
      const heroGlow = ctx.createRadialGradient(
        width / 2,
        0,
        50,
        width / 2,
        0,
        width * 0.65
      );
      heroGlow.addColorStop(0, "rgba(16, 185, 129, 0.08)"); // Subtle Emerald
      heroGlow.addColorStop(0.4, "rgba(245, 158, 11, 0.03)"); // Warm Gold
      heroGlow.addColorStop(1, "rgba(7, 11, 20, 0)");

      ctx.fillStyle = heroGlow;
      ctx.fillRect(0, 0, width, height);

      // Interactive Cursor Ambient Spotlight
      const mouseGlow = ctx.createRadialGradient(
        mouseX,
        mouseY,
        0,
        mouseX,
        mouseY,
        380
      );
      mouseGlow.addColorStop(0, "rgba(16, 185, 129, 0.04)");
      mouseGlow.addColorStop(1, "transparent");

      ctx.fillStyle = mouseGlow;
      ctx.fillRect(0, 0, width, height);

      // Draw Precision Architectural Grid Lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
      ctx.lineWidth = 1;
      const gridSize = 64;

      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw Grid Intersection Micro-Nodes with subtle pulse
      ctx.fillStyle = "rgba(16, 185, 129, 0.18)";
      for (let x = gridSize; x < width; x += gridSize) {
        for (let y = gridSize; y < height; y += gridSize) {
          // Selective node rendering for high aesthetic quality
          if ((x / gridSize + y / gridSize) % 3 === 0) {
            const opacity = 0.15 + Math.sin(tick + x * 0.01 + y * 0.01) * 0.1;
            ctx.fillStyle = `rgba(16, 185, 129, ${opacity})`;
            ctx.beginPath();
            ctx.arc(x, y, 1.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Subtle Background Wave / Trend Curve (Abstract Financial Alpha Signal)
      ctx.beginPath();
      ctx.moveTo(0, height * 0.65);
      for (let x = 0; x <= width; x += 30) {
        const waveY =
          height * 0.65 +
          Math.sin(x * 0.003 + tick * 0.5) * 25 +
          Math.cos(x * 0.008) * 15;
        ctx.lineTo(x, waveY);
      }
      ctx.strokeStyle = "rgba(16, 185, 129, 0.035)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none w-full h-full"
    />
  );
}

