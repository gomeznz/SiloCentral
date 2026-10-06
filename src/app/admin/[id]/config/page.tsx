import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { sites } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { getConfigRow, recentAudit } from "@/lib/site-config";
import { isSiteOnline, lastSeenAt } from "@/lib/site-status";
import {
  addPageAction,
  addSiloAction,
  deletePageAction,
  deleteSiloAction,
  releaseAction,
  requestReimportAction,
  takeOverAction,
} from "../../../config-actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfigSiloForm } from "@/components/config-silo-form";
import { LocalDateTime } from "@/components/local-date-time";
import { LockedRowActions } from "@/components/locked-row-actions";

export const dynamic = "force-dynamic";

export default async function SiteConfigPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { error, ok } = await searchParams;
  const siteId = Number(id);

  const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
  if (!site) notFound();

  const [row, audit] = await Promise.all([getConfigRow(siteId), recentAudit(siteId)]);
  const online = isSiteOnline(lastSeenAt(site));

  const managed = row?.managed ?? false;
  const config = row?.config;
  const version = row?.version ?? 0;
  const failed = row?.applyErrorVersion != null && row.applyErrorVersion >= (row.appliedVersion ?? 0);
  const upToDate = row?.appliedVersion === version;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{site.name} — configuration</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            The pages and silos on this site, including how each is read over Modbus.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/${site.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Site &amp; API key
          </Link>
          <Link href={`/${site.slug}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Dashboard
          </Link>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {ok && <p className="text-sm text-emerald-600 dark:text-emerald-400">{ok}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4 text-sm">
          {!row && (
            <p className="text-slate-600 dark:text-slate-300">
              Waiting for this site to send its configuration. It does this automatically on its next heartbeat
              {online ? "" : " — but the site is offline right now"}, and only once it runs a SiloMon version that
              supports remote configuration.
            </p>
          )}

          {row && !managed && (
            <>
              <p className="text-slate-600 dark:text-slate-300">
                This is a <strong>read-only copy</strong> of what the site sent
                {row.importedAt && (
                  <>
                    {" "}
                    at <LocalDateTime value={row.importedAt} />
                  </>
                )}
                . The site is still edited on its own Setup page. To change it from here, take over management.
              </p>
              {row.importRequested && (
                <p className="text-amber-600 dark:text-amber-400">Waiting for the site to send a fresh copy…</p>
              )}
              <div className="flex flex-wrap items-start gap-6">
                <form action={requestReimportAction}>
                  <input type="hidden" name="siteId" value={siteId} />
                  <Button type="submit" variant="outline" size="sm" disabled={row.importRequested}>
                    Refresh copy from the site
                  </Button>
                </form>
                <form action={takeOverAction} className="flex flex-wrap items-center gap-3">
                  <input type="hidden" name="siteId" value={siteId} />
                  <div className="flex items-start gap-2">
                    <input
                      id="confirm"
                      name="confirm"
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 dark:border-slate-700"
                    />
                    <Label htmlFor="confirm" className="max-w-sm font-normal">
                      I&apos;ve checked this copy is current. It will replace the site&apos;s own pages and silos, and
                      lock its Setup page.
                    </Label>
                  </div>
                  <Button type="submit" size="sm">
                    Take over management
                  </Button>
                </form>
              </div>
            </>
          )}

          {row && managed && (
            <>
              <p className="text-slate-600 dark:text-slate-300">
                <strong>Managed from here</strong> — current version v{version}. Changes are applied to the site
                automatically, and its own Setup page is read-only for pages and silos.
              </p>
              {failed ? (
                <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                  The site could not apply v{row.applyErrorVersion}: {row.applyError}
                </p>
              ) : upToDate ? (
                <p className="text-emerald-600 dark:text-emerald-400">
                  The site has applied v{version}
                  {row.appliedAt && (
                    <>
                      {" "}
                      (<LocalDateTime value={row.appliedAt} />)
                    </>
                  )}
                  .
                </p>
              ) : (
                <p className="text-amber-600 dark:text-amber-400">
                  Waiting for the site to apply v{version} (it has v{row.appliedVersion ?? 0}). It checks about every 30
                  seconds
                  {online ? "." : " — but it is offline, so this applies when it reconnects."}
                </p>
              )}
              <form action={releaseAction}>
                <input type="hidden" name="siteId" value={siteId} />
                <Button type="submit" variant="outline" size="sm">
                  Release management
                </Button>
                <span className="ml-3 text-xs text-slate-400 dark:text-slate-500">
                  Hands editing back to the site&apos;s own Setup page. Nothing is deleted.
                </span>
              </form>
            </>
          )}
        </CardContent>
      </Card>

      {config && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Pages ({config.pages.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {managed && (
                <form action={addPageAction} className="flex items-end gap-2">
                  <input type="hidden" name="siteId" value={siteId} />
                  <input type="hidden" name="expectedVersion" value={version} />
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor="page-name">New page name</Label>
                    <Input id="page-name" name="name" placeholder="e.g. North Yard" required />
                  </div>
                  <Button type="submit">Add page</Button>
                </form>
              )}
              <div className="space-y-2">
                {config.pages.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">No pages.</p>}
                {config.pages.map((p) => (
                  <div
                    key={p.uid}
                    className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
                  >
                    <span>
                      {p.name} <span className="text-slate-400">/{p.slug}</span>
                    </span>
                    {managed && (
                      <LockedRowActions
                        editHref={`/admin/${siteId}/config/pages/${p.uid}`}
                        deleteAction={deletePageAction}
                        deleteFields={{ siteId: String(siteId), expectedVersion: String(version), uid: p.uid }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {managed && (
            <Card>
              <CardHeader>
                <CardTitle>Add a silo</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {config.pages.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">Add a page first.</p>
                ) : (
                  <ConfigSiloForm
                    action={addSiloAction}
                    siteId={siteId}
                    expectedVersion={version}
                    pages={config.pages}
                    submitLabel="Add silo"
                  />
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Silos ({config.silos.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-4">
              {config.silos.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">No silos.</p>}
              {config.silos.map((s) => {
                const page = config.pages.find((p) => p.uid === s.pageUid);
                return (
                  <div
                    key={s.uid}
                    className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
                  >
                    <div>
                      <span className="font-medium">{s.name}</span>{" "}
                      <span className="text-slate-400">
                        · {page?.name ?? "unknown page"} · {s.host}:{s.port} unit {s.unitId} reg {s.registerAddress}{" "}
                        {s.dataType}
                        {!s.isActive && " · not polled"}
                      </span>
                    </div>
                    {managed && (
                      <LockedRowActions
                        editHref={`/admin/${siteId}/config/silos/${s.uid}`}
                        deleteAction={deleteSiloAction}
                        deleteFields={{ siteId: String(siteId), expectedVersion: String(version), uid: s.uid }}
                      />
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent changes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 pt-4 text-sm">
          {audit.length === 0 && <p className="text-slate-500 dark:text-slate-400">Nothing yet.</p>}
          {audit.map((a) => (
            <div key={a.id} className="flex flex-wrap gap-x-3 text-slate-600 dark:text-slate-300">
              <span className="text-xs text-slate-400 dark:text-slate-500">
                <LocalDateTime value={a.createdAt} />
              </span>
              <span className="font-medium">{a.username}</span>
              <span>{a.summary}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
