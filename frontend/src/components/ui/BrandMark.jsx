export default function BrandMark({ className = '' }) {
  return (
    <div
      className={`relative grid place-items-center overflow-hidden rounded-[24px] ${className}`.trim()}
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#0f766e_0%,#0f5d75_50%,#d97706_100%)]" />
      <div className="absolute inset-[1px] rounded-[22px] bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.6),transparent_48%),linear-gradient(160deg,rgba(255,255,255,0.96),rgba(255,255,255,0.76))]" />

      <svg
        viewBox="0 0 64 64"
        className="relative z-10 h-[72%] w-[72%] drop-shadow-[0_8px_16px_rgba(15,23,42,0.12)]"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="brand-sheet" x1="16" y1="14" x2="46" y2="50" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffffff" />
            <stop offset="1" stopColor="#dff5ef" />
          </linearGradient>
          <linearGradient id="brand-burst" x1="36" y1="12" x2="50" y2="28" gradientUnits="userSpaceOnUse">
            <stop stopColor="#14b8a6" />
            <stop offset="1" stopColor="#0f766e" />
          </linearGradient>
        </defs>
        <rect x="16" y="14" width="30" height="36" rx="9" fill="url(#brand-sheet)" />
        <path d="M24 25h14" stroke="#0f172a" strokeWidth="3.4" strokeLinecap="round" opacity="0.78" />
        <path d="M24 31h11" stroke="#0f172a" strokeWidth="3.4" strokeLinecap="round" opacity="0.58" />
        <path d="M24 37h15" stroke="#0f172a" strokeWidth="3.4" strokeLinecap="round" opacity="0.58" />
        <circle cx="43" cy="18" r="7" fill="url(#brand-burst)" />
        <path d="M43 14.2v7.6M39.2 18h7.6" stroke="#f8fafc" strokeWidth="2.8" strokeLinecap="round" />
      </svg>
    </div>
  )
}
