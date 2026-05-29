import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

// Reusable slide-in panel used by Settings (right), Memory and History (left).
export const SlidePanel = ({
  open,
  side = "right",
  onClose,
  title,
  subtitle,
  testid,
  children,
  footer,
}) => {
  const offscreen = side === "right" ? "100%" : "-100%";
  const borderSide = side === "right" ? "border-l" : "border-r";
  const posSide = side === "right" ? "right-0" : "left-0";

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            data-testid={`${testid}-backdrop`}
          />
          <motion.aside
            className={`fixed top-0 ${posSide} z-[70] flex h-full w-full max-w-md flex-col bg-vox-s1 ${borderSide} border-vox-border shadow-2xl`}
            initial={{ x: offscreen }}
            animate={{ x: 0 }}
            exit={{ x: offscreen }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            data-testid={testid}
          >
            <header className="flex items-start justify-between gap-4 border-b border-vox-border px-7 pb-5 pt-7">
              <div>
                <h2 className="font-heading text-2xl font-medium text-vox-text">
                  {title}
                </h2>
                {subtitle ? (
                  <p className="mt-1 text-sm text-vox-muted">{subtitle}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-full text-vox-muted transition-colors hover:bg-vox-s2 hover:text-vox-text"
                data-testid={`${testid}-close`}
                aria-label="Close panel"
              >
                <X size={18} />
              </button>
            </header>

            <div className="vox-scroll flex-1 overflow-y-auto px-7 py-6">
              {children}
            </div>

            {footer ? (
              <div className="border-t border-vox-border px-7 py-5">
                {footer}
              </div>
            ) : null}
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
};

export default SlidePanel;
