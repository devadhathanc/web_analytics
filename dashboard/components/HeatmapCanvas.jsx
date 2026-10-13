'use client';

import React, { useEffect, useRef, useState } from 'react';

export default function HeatmapCanvas({ clicks = [], selectedUrl = '', currentMode = 'density' }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [hoveredClick, setHoveredClick] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  function getCanvasCoords(click, width, height) {
    if (click.xPercent > 0 && click.yPercent > 0) {
      return { x: (click.xPercent / 100) * width, y: (click.yPercent / 100) * height };
    }
    if (click.x !== undefined && click.viewportWidth) {
      return { x: (click.x / click.viewportWidth) * width, y: (click.y / (click.viewportHeight || 800)) * height };
    }
    return { x: (click.x || 0) % width, y: (click.y || 0) % height };
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.clientWidth || 900;
    const height = canvas.clientHeight || 580;
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);

    if (clicks.length === 0) return;

    if (currentMode === 'density') drawDensity(ctx, width, height);
    else if (currentMode === 'dots') drawScatter(ctx, width, height);
    else if (currentMode === 'grid') drawGrid(ctx, width, height);
  }, [clicks, currentMode]);

  function drawDensity(ctx, w, h) {
    const mask = document.createElement('canvas');
    mask.width = w;
    mask.height = h;
    const mCtx = mask.getContext('2d');

    const radius = Math.max(18, Math.min(45, w * 0.04 * (1 / Math.sqrt(clicks.length / 10))));

    clicks.forEach((c) => {
      const { x, y } = getCanvasCoords(c, w, h);
      const g = mCtx.createRadialGradient(x, y, 0, x, y, radius);
      g.addColorStop(0, 'rgba(0,0,0,0.5)');
      g.addColorStop(0.4, 'rgba(0,0,0,0.2)');
      g.addColorStop(0.7, 'rgba(0,0,0,0.05)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      mCtx.fillStyle = g;
      mCtx.beginPath();
      mCtx.arc(x, y, radius, 0, Math.PI * 2);
      mCtx.fill();
    });

    // Thermal colormap LUT: transparent blue → cyan → green → yellow → red
    const lut = buildThermalLUT();
    const imgData = mCtx.getImageData(0, 0, w, h);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha > 0) {
        const lutIdx = Math.min(255, Math.round(alpha * 2.2)) * 4;
        data[i]     = lut[lutIdx];
        data[i + 1] = lut[lutIdx + 1];
        data[i + 2] = lut[lutIdx + 2];
        data[i + 3] = Math.min(220, alpha * 2.4);
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }

  function buildThermalLUT() {
    const lutCanvas = document.createElement('canvas');
    lutCanvas.width = 256;
    lutCanvas.height = 1;
    const lCtx = lutCanvas.getContext('2d');
    const g = lCtx.createLinearGradient(0, 0, 256, 0);
    g.addColorStop(0.00, 'rgba(0,   0,   255, 0)');
    g.addColorStop(0.10, 'rgba(0,   0,   255, 1)');
    g.addColorStop(0.30, 'rgba(0,   220, 220, 1)');
    g.addColorStop(0.50, 'rgba(0,   200, 0,   1)');
    g.addColorStop(0.70, 'rgba(255, 230, 0,   1)');
    g.addColorStop(0.90, 'rgba(255, 80,  0,   1)');
    g.addColorStop(1.00, 'rgba(255, 0,   0,   1)');
    lCtx.fillStyle = g;
    lCtx.fillRect(0, 0, 256, 1);
    return lCtx.getImageData(0, 0, 256, 1).data;
  }

  function drawScatter(ctx, w, h) {
    clicks.forEach((c) => {
      const { x, y } = getCanvasCoords(c, w, h);

      // Outer glow ring
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 80, 0, 0.08)';
      ctx.fill();

      // Mid ring
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 160, 0, 0.18)';
      ctx.fill();

      // Inner dot — red
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 60, 0, 0.9)';
      ctx.fill();

      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255, 200, 0, 0.5)';
      ctx.stroke();
    });
  }

  function drawGrid(ctx, w, h) {
    const cols = 6;
    const rows = 4;
    const cellW = w / cols;
    const cellH = h / rows;
    const counts = Array.from({ length: rows }, () => Array(cols).fill(0));

    clicks.forEach((c) => {
      const px = (c.xPercent || 50) / 100;
      const py = (c.yPercent || 50) / 100;
      counts[Math.min(rows - 1, Math.floor(py * rows))][Math.min(cols - 1, Math.floor(px * cols))]++;
    });

    const maxCount = Math.max(1, ...counts.flat());

    for (let r = 0; r < rows; r++) {
      for (let cc = 0; cc < cols; cc++) {
        const count = counts[r][cc];
        const ratio = count / maxCount;
        const x = cc * cellW;
        const y = r * cellH;

        // Thermal cell fill: blue (cold) → red (hot)
        const hue = Math.round(240 - ratio * 240);
        ctx.fillStyle = `hsla(${hue}, 90%, 55%, ${ratio * 0.55 + 0.03})`;
        ctx.fillRect(x + 1.5, y + 1.5, cellW - 3, cellH - 3);

        // Grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, cellW, cellH);

        if (count > 0) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.font = '600 13px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${count}`, x + cellW / 2, y + cellH / 2 - 7);

          ctx.font = '11px Inter, sans-serif';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.fillText(`${Math.round((count / clicks.length) * 100)}%`, x + cellW / 2, y + cellH / 2 + 9);
        }
      }
    }
  }

  const handleMouseMove = (e) => {
    if (currentMode !== 'dots' || clicks.length === 0) { if (hoveredClick) setHoveredClick(null); return; }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setMousePos({ x: mx, y: my });

    let found = null;
    for (const c of clicks) {
      const { x, y } = getCanvasCoords(c, canvas.width, canvas.height);
      if (Math.hypot(mx - x, my - y) < 20) { found = c; break; }
    }
    setHoveredClick(found);
  };

  return (
    <div className="heatmap-stage" ref={containerRef} onMouseMove={handleMouseMove}>
      <div className="heatmap-backdrop-mock">
        <div className="mock-wireframe-header"></div>
        <div className="mock-wireframe-hero"></div>
        <div className="mock-wireframe-grid">
          <div className="mock-wireframe-card"></div>
          <div className="mock-wireframe-card"></div>
          <div className="mock-wireframe-card"></div>
        </div>
      </div>

      <canvas ref={canvasRef} className="heatmap-canvas" />

      {hoveredClick && (
        <div className="heatmap-tooltip" style={{ left: `${mousePos.x}px`, top: `${mousePos.y}px` }}>
          <div style={{ fontWeight: 600, marginBottom: '2px' }}>
            {hoveredClick.targetText ? `"${hoveredClick.targetText}"` : (hoveredClick.targetTag || 'element')}
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem', color: 'var(--text-2)' }}>
            ({hoveredClick.x}px, {hoveredClick.y}px) · {hoveredClick.xPercent}% × {hoveredClick.yPercent}%
          </div>
          {hoveredClick.targetSelector && (
            <div style={{ color: 'var(--text-4)', fontSize: '0.65rem', marginTop: '2px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {hoveredClick.targetSelector}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
