"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// How often a dashboard re-reads its data. Sites report about once a minute
// and ping every 30s, so checking twice as often as a report keeps the page
// current without hammering the database.
const REFRESH_INTERVAL_MS = 30_000;

// Re-renders the page's server data on a timer (router.refresh keeps client
// state such as the chosen trend range and scroll position) and shows a
// countdown bar that fills over each interval. Skips refreshes while the tab
// is hidden, and catches up the moment it's visible again.
export function AutoRefresh() {
  const router = useRouter();
  // Bumped on every refresh; the bar's key, so it restarts in step.
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    function refresh() {
      router.refresh();
      setCycle((c) => c + 1);
    }

    const interval = setInterval(() => {
      if (!document.hidden) refresh();
    }, REFRESH_INTERVAL_MS);

    function onVisibility() {
      if (!document.hidden) refresh();
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router]);

  return (
    <div
      className="ml-auto flex w-44 items-center gap-2 text-xs text-slate-400 dark:text-slate-500"
      title={`This page refreshes every ${REFRESH_INTERVAL_MS / 1000} seconds`}
    >
      <span className="whitespace-nowrap">Live · every {REFRESH_INTERVAL_MS / 1000}s</span>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" aria-hidden="true">
        <div
          key={cycle}
          className="poll-progress h-full rounded-full bg-indigo-500 dark:bg-indigo-400"
          style={{ animationDuration: `${REFRESH_INTERVAL_MS}ms` }}
        />
      </div>
    </div>
  );
}
