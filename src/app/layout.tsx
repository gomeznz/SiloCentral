import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "./auth-actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "SiloCentral",
  description: "Aggregated status across SiloMon sites",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Display only (who to show in the header). Access control is not done
  // here: layouts don't re-run on client-side navigation, so every page and
  // action checks for itself — see src/lib/auth.ts.
  const user = await getCurrentUser();

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/85">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-8 py-3">
            <Link href="/" className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Silo<span className="text-indigo-500 dark:text-indigo-400">Central</span>
            </Link>
            {user && (
              <div className="ml-auto flex items-center gap-3 text-sm">
                <Link
                  href="/account"
                  className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                >
                  {user.username}
                </Link>
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="cursor-pointer text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            )}
          </div>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="border-t border-slate-200 px-8 py-4 text-xs text-slate-400 dark:border-slate-800 dark:text-slate-600">
          v{process.env.APP_VERSION ?? "dev"}
        </footer>
      </body>
    </html>
  );
}
