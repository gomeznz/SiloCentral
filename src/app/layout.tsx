import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "SiloCentral",
  description: "Aggregated status across SiloMon sites",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/85">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-8 py-3">
            <Link href="/" className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Silo<span className="text-indigo-500 dark:text-indigo-400">Central</span>
            </Link>
          </div>
        </header>
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
