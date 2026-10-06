import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getConfigRow } from "@/lib/site-config";
import { updateSiloAction } from "../../../../../config-actions";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfigSiloForm } from "@/components/config-silo-form";

export const dynamic = "force-dynamic";

export default async function EditConfigSiloPage({
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
  // Only a managed site can be edited from here.
  if (!row.managed) redirect(`/admin/${siteId}/config`);

  const silo = row.config.silos.find((s) => s.uid === uid);
  if (!silo) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Edit silo</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{silo.name}</p>
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
          <ConfigSiloForm
            action={updateSiloAction}
            siteId={siteId}
            expectedVersion={row.version}
            pages={row.config.pages}
            silo={silo}
            submitLabel="Save changes"
          />
        </CardContent>
      </Card>
    </div>
  );
}
