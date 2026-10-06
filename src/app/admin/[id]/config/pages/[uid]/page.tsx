import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getConfigRow } from "@/lib/site-config";
import { updatePageAction } from "../../../../../config-actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function EditConfigPagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; uid: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const { id, uid } = await params;
  const { error } = await searchParams;
  const siteId = Number(id);

  const row = await getConfigRow(siteId);
  if (!row) notFound();
  if (!row.managed) redirect(`/admin/${siteId}/config`);

  const page = row.config.pages.find((p) => p.uid === uid);
  if (!page) notFound();

  return (
    <div className="mx-auto max-w-xl space-y-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Edit page</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{page.name}</p>
        </div>
        <Link href={`/admin/${siteId}/config`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          Back
        </Link>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <Card>
        <CardContent className="pt-4">
          <form action={updatePageAction} className="space-y-4">
            <input type="hidden" name="siteId" value={siteId} />
            <input type="hidden" name="expectedVersion" value={row.version} />
            <input type="hidden" name="uid" value={page.uid} />
            <div className="space-y-1.5">
              <Label htmlFor="name">Page name</Label>
              <Input id="name" name="name" defaultValue={page.name} required />
            </div>
            <div className="max-w-40 space-y-1.5">
              <Label htmlFor="sortOrder">Order</Label>
              <Input id="sortOrder" name="sortOrder" type="number" min={0} defaultValue={page.sortOrder} />
            </div>
            <Button type="submit" className="w-full">
              Save changes
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
