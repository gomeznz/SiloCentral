// The SiloCentral mark: a silo whose product level slowly rises and falls,
// next to the same "Silo" + indigo "Central" wordmark the header uses.
export function SiloCentralLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-3 ${className}`}>
      <svg
        width="44"
        height="52"
        viewBox="0 0 44 52"
        role="img"
        aria-label="SiloCentral"
        className="text-slate-700 dark:text-slate-200"
      >
        <defs>
          <clipPath id="silocentral-logo-body">
            <path d="M6 14 Q22 -2 38 14 V44 a4 4 0 0 1 -4 4 H10 a4 4 0 0 1 -4 -4 Z" />
          </clipPath>
        </defs>
        <g clipPath="url(#silocentral-logo-body)">
          <rect x="0" y="0" width="44" height="52" className="fill-slate-200 dark:fill-slate-800" />
          <rect x="0" y="22" width="44" height="30" className="login-level fill-indigo-500 dark:fill-indigo-400" />
        </g>
        <path
          d="M6 14 Q22 -2 38 14 V44 a4 4 0 0 1 -4 4 H10 a4 4 0 0 1 -4 -4 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path d="M6 24 H38 M6 34 H38" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
      </svg>
      <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
        Silo<span className="text-indigo-500 dark:text-indigo-400">Central</span>
      </span>
    </div>
  );
}
