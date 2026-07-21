import React, { useEffect, useRef } from "react";

const TechLinesBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = (canvas.width = window.innerWidth);
    const height = (canvas.height = window.innerHeight);

    const lines: { x: number; y: number; length: number; angle: number; speed: number }[] = [];

    for (let i = 0; i < 100; i++) {
      lines.push({
        x: Math.random() * width,
        y: Math.random() * height,
        length: Math.random() * 100 + 20,
        angle: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.5 + 0.2,
      });
    }

    const drawLines = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = "rgba(0, 255, 255, 0.5)";
      ctx.lineWidth = 2;

      lines.forEach((line, index) => {
        ctx.beginPath();
        ctx.moveTo(line.x, line.y);
        ctx.lineTo(
          line.x + Math.cos(line.angle) * line.length,
          line.y + Math.sin(line.angle) * line.length
        );
        ctx.stroke();

        line.x += Math.cos(line.angle) * line.speed;
        line.y += Math.sin(line.angle) * line.speed;

        if (line.x > width || line.x < 0 || line.y > height || line.y < 0) {
          lines[index] = {
            x: Math.random() * width,
            y: Math.random() * height,
            length: Math.random() * 100 + 20,
            angle: Math.random() * Math.PI * 2,
            speed: Math.random() * 0.5 + 0.2,
          };
        }
      });
    };

    const animate = () => {
      drawLines();
      requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(8);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: -1 }}
    ></canvas>
  );
};

export default TechLinesBackground;
