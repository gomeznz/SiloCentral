import Link from "next/link";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { sites } from "@/db/schema";
import { updateSiteAction, regenerateApiKeyAction } from "../../actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Reads live DB state on every request — must not be statically prerendered
// at build time (the DB isn't reachable from the build environment anyway).
export const dynamic = "force-dynamic";

// This dashboard's own public URL, for the copy-pasteable config block
// below. Prefers Railway's own domain variable; falls back to the actual
// request's Host header (works for local dev, or any non-Railway deploy).
async function getDashboardUrl(): Promise<string> {
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : "<this dashboard's URL>";
}

export default async function EditSitePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const siteId = Number(id);

  const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
  if (!site) {
    notFound();
  }

  const dashboardUrl = await getDashboardUrl();

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Edit site</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">/{site.slug}</p>
        </div>
        <Link href="/admin" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Setup
        </Link>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <Card>
        <CardContent className="pt-4">
          <form action={updateSiteAction} className="flex items-end gap-2">
            <input type="hidden" name="id" value={site.id} />
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="name">Site name</Label>
              <Input id="name" name="name" defaultValue={site.name} required />
            </div>
            <Button type="submit">Save</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Worker config for this site</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Paste these into the &ldquo;Central dashboard&rdquo; card on that site&apos;s own Setup page
            (<code>/admin</code> on its SiloMon instance) — no restart needed, it takes effect on the worker&apos;s
            next push.
          </p>
          <pre className="overflow-x-auto rounded-md border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-900">
{`Dashboard URL: ${dashboardUrl}
API key: ${site.apiKey}`}
          </pre>
          <form action={regenerateApiKeyAction}>
            <input type="hidden" name="id" value={site.id} />
            <Button type="submit" variant="outline" size="sm">
              Regenerate key
            </Button>
            <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
              Invalidates the key above immediately — that site&apos;s worker will fail to push until it&apos;s
              updated with the new one.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
