import { motion } from "framer-motion";
import { ArrowRight, Layers3 } from "lucide-react";

export default function BottomBanner({ onBrowse }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.45 }}
      className="bottom-banner mx-auto mt-6 w-full max-w-[720px]"
    >
      <div className="flex items-center gap-2.5 text-sm font-medium text-text-muted">
        <Layers3 className="h-4 w-4 text-brand" />
        Discover and remix app ideas
      </div>
      <button
        type="button"
        onClick={onBrowse}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(255,255,255,0.1)] bg-transparent px-4 py-2 text-sm font-medium text-text-muted transition hover:bg-white/[0.06] hover:text-text"
      >
        Browse the app gallery
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  );
}
