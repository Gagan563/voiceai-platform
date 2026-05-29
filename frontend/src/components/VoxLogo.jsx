// Inline soundwave mark: theme-adaptive and crisp at any size.
export const VoxMark = ({ size = 36, className = "" }) => (
  <div
    className={`relative grid place-items-center rounded-xl bg-vox-primary/15 ring-1 ring-vox-primary/30 ${className}`}
    style={{ width: size, height: size }}
    data-testid="vox-mark"
  >
    <svg
      width={size * 0.58}
      height={size * 0.58}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--vox-primary)"
      strokeWidth="2.4"
      strokeLinecap="round"
    >
      <line x1="3" y1="12" x2="3" y2="12" />
      <line x1="7" y1="8" x2="7" y2="16" />
      <line x1="11" y1="4" x2="11" y2="20" />
      <line x1="15" y1="7" x2="15" y2="17" />
      <line x1="19" y1="10" x2="19" y2="14" />
    </svg>
  </div>
);

export const VoxLogo = ({ showText = true, size = 36 }) => (
  <div className="flex select-none items-center gap-3">
    <VoxMark size={size} />
    {showText ? (
      <span className="font-heading text-xl font-semibold tracking-tight text-vox-text">
        Vox<span className="text-vox-primary">Mind</span>
      </span>
    ) : null}
  </div>
);

export default VoxLogo;
