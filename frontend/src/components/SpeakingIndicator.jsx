import { motion } from "framer-motion";
import { Square } from "lucide-react";

/**
 * Animated waveform indicator shown while TTS is speaking.
 * Displays three bouncing bars and a stop button.
 */
export default function SpeakingIndicator({ onStop }) {
  const barVariants = {
    animate: (i) => ({
      scaleY: [1, 2.2, 1],
      transition: {
        duration: 0.6,
        repeat: Infinity,
        delay: i * 0.15,
        ease: "easeInOut",
      },
    }),
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.15 }}
      className="inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/10 px-2.5 py-1"
    >
      {/* Waveform bars */}
      <div className="flex items-center gap-[3px] h-4">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            custom={i}
            animate="animate"
            variants={barVariants}
            className="w-[3px] h-2 rounded-full bg-brand origin-bottom"
          />
        ))}
      </div>

      <span className="text-[10px] font-semibold text-brand">Speaking</span>

      {/* Stop button */}
      {onStop && (
        <button
          type="button"
          onClick={onStop}
          className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/20 text-brand transition hover:bg-brand/30"
          title="Stop speaking"
          aria-label="Stop speaking"
        >
          <Square className="h-2.5 w-2.5 fill-current" />
        </button>
      )}
    </motion.div>
  );
}
