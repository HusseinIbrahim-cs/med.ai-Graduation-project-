import { useEffect, useRef } from "react";

/**
 * Ultra-lightweight ambient wave background using HTML5 Canvas.
 * Renders kinetic multi-layered waves that shift through light blues,
 * mint greens, and teals. Designed to sit behind app content (z=-10).
 */
export function WaveBackground() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    const layers = [
      { amp: 50, len: 0.0042, speed: 0.00035, y: 0.35, color: "rgba(125, 211, 252, 0.35)" }, // light blue
      { amp: 65, len: 0.0033, speed: 0.00025, y: 0.55, color: "rgba(94, 234, 212, 0.32)" }, // teal
      { amp: 80, len: 0.0025, speed: 0.0002, y: 0.75, color: "rgba(167, 243, 208, 0.30)" }, // mint
      { amp: 45, len: 0.005, speed: 0.0004, y: 0.2, color: "rgba(186, 230, 253, 0.28)" }, // soft sky
    ];

    function draw(t: number) {
      ctx!.clearRect(0, 0, w, h);
      // base soft gradient wash
      const g = ctx!.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "rgba(240, 253, 250, 0.6)");
      g.addColorStop(1, "rgba(224, 242, 254, 0.5)");
      ctx!.fillStyle = g;
      ctx!.fillRect(0, 0, w, h);

      for (const L of layers) {
        ctx!.beginPath();
        ctx!.moveTo(0, h);
        const baseY = h * L.y;
        for (let x = 0; x <= w; x += 8) {
          const y =
            baseY +
            Math.sin(x * L.len + t * L.speed) * L.amp +
            Math.cos(x * L.len * 0.6 + t * L.speed * 1.3) * L.amp * 0.4;
          ctx!.lineTo(x, y);
        }
        ctx!.lineTo(w, h);
        ctx!.closePath();
        ctx!.fillStyle = L.color;
        ctx!.fill();
      }
      rafRef.current = requestAnimationFrame(draw);
    }
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 h-screen w-screen"
    />
  );
}
