import Link from "next/link";
import { headers } from "next/headers";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { customers, customerSites, sites } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { deleteCustomerAction, updateCustomerAction } from "../../customer-actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocalDateTime } from "@/components/local-date-time";
import { CreateCustomerForm } from "@/components/create-customer-form";
import { RegenerateKeyForm } from "@/components/regenerate-key-form";
import { SiteCheckboxes } from "@/components/site-checkboxes";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  await requireAdmin();
  const { error, ok } = await searchParams;

  const [allCustomers, allSites, grants] = await Promise.all([
    db.select().from(customers).orderBy(asc(customers.name)),
    db.select({ id: sites.id, name: sites.name }).from(sites).orderBy(asc(sites.name)),
    db.select().from(customerSites),
  ]);

  // For the example call shown below. Behind Railway's proxy the public
  // address is in the forwarded headers.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "your-silocentral-address";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const baseUrl = `${proto}://${host}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Customers &amp; API keys</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Give an outside party read-only access to the data over HTTPS. Each customer gets a key of their own and
            sees only the sites you tick for them. Customers don&apos;t sign in; for a person who should browse the
            dashboards, add a viewer under Users instead.
          </p>
        </div>
        <Link href="/admin" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Setup
        </Link>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {ok && <p className="text-sm text-emerald-600 dark:text-emerald-400">{ok}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Add a customer</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <CreateCustomerForm sites={allSites} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Customers ({allCustomers.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {allCustomers.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">No customers yet.</p>
          )}
          {allCustomers.map((customer) => {
            const selected = grants.filter((g) => g.customerId === customer.id).map((g) => g.siteId);
            return (
              <div
                key={customer.id}
                className="space-y-4 rounded-md border border-slate-200 p-4 text-sm dark:border-slate-800"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-base font-medium">{customer.name}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    Key <span className="font-mono">{customer.keyPrefix}…</span> ·{" "}
                    {customer.lastUsedAt ? (
                      <>
                        last used <LocalDateTime value={customer.lastUsedAt} />
                      </>
                    ) : (
                      "never used"
                    )}
                  </span>
                </div>

                <form action={updateCustomerAction} className="space-y-3">
                  <input type="hidden" name="id" value={customer.id} />
                  <div className="space-y-1.5">
                    <Label htmlFor={`name-${customer.id}`}>Name</Label>
                    <Input id={`name-${customer.id}`} name="name" defaultValue={customer.name} required />
                  </div>
                  <SiteCheckboxes sites={allSites} selected={selected} idPrefix={`c${customer.id}`} />
                  <Button type="submit" size="sm">
                    Save name and sites
                  </Button>
                </form>

                <RegenerateKeyForm customerId={customer.id} customerName={customer.name} />

                <form action={deleteCustomerAction} className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-3 dark:border-slate-800">
                  <input type="hidden" name="id" value={customer.id} />
                  <div className="flex items-center gap-2">
                    <input
                      id={`delete-confirm-${customer.id}`}
                      name="confirm"
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-slate-700"
                    />
                    <Label htmlFor={`delete-confirm-${customer.id}`} className="font-normal">
                      Delete this customer (their key stops working)
                    </Label>
                  </div>
                  <Button type="submit" size="sm" variant="outline">
                    Delete
                  </Button>
                </form>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What the customer does with the key</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4 text-sm">
          <p>
            They send it as a Bearer token. Three read-only calls are available: <code>/api/v1/sites</code>,{" "}
            <code>/api/v1/levels</code> (current levels) and <code>/api/v1/history</code> (past levels). Each can return
            CSV as well as JSON with <code>?format=csv</code>.
          </p>
          <pre className="overflow-x-auto rounded-md bg-slate-100 p-3 text-xs dark:bg-slate-900">
            {`curl ${baseUrl}/api/v1/levels \\
  -H "Authorization: Bearer $SILOCENTRAL_KEY"

curl "${baseUrl}/api/v1/history?site=<site-slug>&from=2026-09-01&to=2026-09-14&interval=1h" \\
  -H "Authorization: Bearer $SILOCENTRAL_KEY"`}
          </pre>
          <p className="text-slate-500 dark:text-slate-400">
            Full details (parameters, response shapes, limits) are in the Silo Telemetry API reference. Keys are limited
            to 120 requests a minute.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
