import React, { useEffect, useRef } from "react";

/**
 * VoiceOrb — Fluid organic audio-reactive canvas visualizer.
 * Reacts to microphone volume level and speaking frequencies.
 */
export default function VoiceOrb({
  isListening = false,
  isSpeaking = false,
  audioLevel = 0,
  size = 200,
  className = "",
  onClick,
}) {
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let time = 0;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    function render() {
      time += isListening ? 0.04 : isSpeaking ? 0.06 : 0.015;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const center = (size * dpr) / 2;
      const baseRadius = (size * dpr) * 0.28;
      const activeBoost = isListening
        ? 0.2 + Math.min(0.6, audioLevel * 0.8)
        : isSpeaking
        ? 0.35 + Math.sin(time * 3) * 0.15
        : 0.08;

      // Glow background
      const glowGrad = ctx.createRadialGradient(
        center,
        center,
        baseRadius * 0.3,
        center,
        center,
        baseRadius * (1.8 + activeBoost)
      );

      if (isListening) {
        glowGrad.addColorStop(0, "rgba(56, 189, 248, 0.7)"); // sky blue
        glowGrad.addColorStop(0.5, "rgba(99, 102, 241, 0.4)"); // indigo
        glowGrad.addColorStop(1, "rgba(14, 165, 233, 0)");
      } else if (isSpeaking) {
        glowGrad.addColorStop(0, "rgba(168, 85, 247, 0.8)"); // purple
        glowGrad.addColorStop(0.5, "rgba(236, 72, 153, 0.4)"); // pink
        glowGrad.addColorStop(1, "rgba(168, 85, 247, 0)");
      } else {
        glowGrad.addColorStop(0, "rgba(99, 102, 241, 0.35)");
        glowGrad.addColorStop(0.6, "rgba(59, 130, 246, 0.15)");
        glowGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      }

      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(center, center, baseRadius * 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Fluid Organic Polygon Layers
      const layers = 3;
      for (let l = 0; l < layers; l++) {
        ctx.beginPath();
        const points = 36;
        const layerRadius = baseRadius * (1 + l * 0.12);

        for (let i = 0; i <= points; i++) {
          const angle = (i / points) * Math.PI * 2;
          const noise =
            Math.sin(angle * 3 + time + l) * 0.5 +
            Math.cos(angle * 5 - time * 1.5 + l * 2) * 0.3 +
            Math.sin(angle * 7 + time * 2) * 0.2;

          const r = layerRadius * (1 + noise * activeBoost);
          const x = center + Math.cos(angle) * r;
          const y = center + Math.sin(angle) * r;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();

        const strokeGrad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        if (isListening) {
          strokeGrad.addColorStop(0, "rgba(56, 189, 248, 0.8)");
          strokeGrad.addColorStop(1, "rgba(129, 140, 248, 0.8)");
        } else if (isSpeaking) {
          strokeGrad.addColorStop(0, "rgba(244, 114, 182, 0.9)");
          strokeGrad.addColorStop(1, "rgba(168, 85, 247, 0.9)");
        } else {
          strokeGrad.addColorStop(0, "rgba(99, 102, 241, 0.4)");
          strokeGrad.addColorStop(1, "rgba(59, 130, 246, 0.4)");
        }

        ctx.strokeStyle = strokeGrad;
        ctx.lineWidth = 2 * dpr;
        ctx.stroke();

        ctx.fillStyle = l === 0 ? "rgba(15, 23, 42, 0.6)" : "transparent";
        if (l === 0) ctx.fill();
      }

      // Inner Core Pulse
      ctx.beginPath();
      const coreR = baseRadius * 0.4 * (1 + (isListening || isSpeaking ? Math.sin(time * 4) * 0.2 : 0));
      ctx.arc(center, center, coreR, 0, Math.PI * 2);
      ctx.fillStyle = isListening
        ? "rgba(125, 211, 252, 0.9)"
        : isSpeaking
        ? "rgba(244, 114, 182, 0.9)"
        : "rgba(129, 140, 248, 0.6)";
      ctx.shadowBlur = 15 * dpr;
      ctx.shadowColor = isListening ? "#38bdf8" : isSpeaking ? "#ec4899" : "#6366f1";
      ctx.fill();
      ctx.shadowBlur = 0;

      animationFrameRef.current = requestAnimationFrame(render);
    }

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isListening, isSpeaking, audioLevel, size]);

  return (
    <div
      onClick={onClick}
      className={`relative inline-flex items-center justify-center cursor-pointer transition-transform duration-300 hover:scale-105 active:scale-95 ${className}`}
      style={{ width: size, height: size }}
      title={isListening ? "Listening... Click to stop" : "Click to speak with NOVA"}
    >
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
        className="pointer-events-none drop-shadow-2xl"
      />
    </div>
  );
}
