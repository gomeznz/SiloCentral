// Decorative animated background for the sign-in page. Fixed behind
// everything (-z-10) and ignored by assistive tech and pointer events.
const WAVE = "M0 60 Q300 0 600 60 T1200 60 T1800 60 T2400 60 V120 H0 Z";

export function LoginBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-indigo-50/60 to-slate-100 dark:from-slate-950 dark:via-slate-950 dark:to-indigo-950/40" />

      <div className="login-blob-a absolute -left-[10%] top-[5%] h-[45vmax] w-[45vmax] rounded-full bg-indigo-300/40 blur-3xl dark:bg-indigo-600/20" />
      <div className="login-blob-b absolute -right-[12%] top-[30%] h-[40vmax] w-[40vmax] rounded-full bg-sky-300/40 blur-3xl dark:bg-sky-600/15" />

      <svg
        className="absolute bottom-0 left-0 h-40 w-[200%] login-wave-back text-indigo-300/50 dark:text-indigo-500/15"
        viewBox="0 0 2400 120"
        preserveAspectRatio="none"
      >
        <path d={WAVE} fill="currentColor" />
      </svg>
      <svg
        className="absolute -bottom-2 left-0 h-28 w-[200%] login-wave-front text-indigo-400/50 dark:text-indigo-400/20"
        viewBox="0 0 2400 120"
        preserveAspectRatio="none"
      >
        <path d={WAVE} fill="currentColor" />
      </svg>
    </div>
  );
}
