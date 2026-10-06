import { cn } from "@/lib/utils";

// Whether the SITE is reachable — distinct from StatusBadge, which is about a
// silo's level. A site can be online with every silo OFFLINE (the Pi is up
// but the PLC isn't answering), and the two must not look alike.
export function SiteOnlineBadge({ online, className }: { online: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        online
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
          : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
        className,
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", online ? "bg-emerald-500 dark:bg-emerald-400" : "bg-red-500 dark:bg-red-400")}
      />
      {online ? "ONLINE" : "OFFLINE"}
    </span>
  );
}
