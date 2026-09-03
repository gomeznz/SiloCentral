import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { sites } from "@/db/schema";
import { createSiteAction, deleteSiteAction } from "../actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LockedRowActions } from "@/components/locked-row-actions";

// Reads live DB state on every request — must not be statically prerendered
// at build time (the DB isn't reachable from the build environment anyway).
export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const allSites = await db.select().from(sites).orderBy(asc(sites.name));

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Setup</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Register each SiloMon site here, then paste the dashboard URL and API key shown on its edit page
            into that site&apos;s own Setup page (Central dashboard card) so its worker starts pushing reports.
          </p>
        </div>
        <Link href="/" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Sites
        </Link>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Add a site</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <form action={createSiteAction} className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="name">Site name</Label>
              <Input id="name" name="name" placeholder="e.g. Gladvale Yard" required />
            </div>
            <Button type="submit">Add site</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sites ({allSites.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-4">
          {allSites.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">No sites yet.</p>
          )}
          {allSites.map((site) => (
            <div
              key={site.id}
              className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
            >
              <div>
                <span className="font-medium">{site.name}</span>{" "}
                <span className="text-slate-400">/{site.slug}</span>
              </div>
              <LockedRowActions editHref={`/admin/${site.id}`} deleteAction={deleteSiteAction} deleteId={site.id} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
