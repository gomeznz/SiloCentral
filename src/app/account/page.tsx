import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { changeOwnPasswordAction } from "../user-actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const user = await requireUser();
  const { error, ok } = await searchParams;

  return (
    <div className="mx-auto max-w-md space-y-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Your account</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Signed in as {user.username} ({user.role}).
          </p>
        </div>
        <Link href="/" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Sites
        </Link>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {ok && <p className="text-sm text-emerald-600 dark:text-emerald-400">{ok}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <form action={changeOwnPasswordAction} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="current">Current password</Label>
              <Input id="current" name="current" type="password" autoComplete="current-password" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="next">New password (10+ characters)</Label>
              <Input id="next" name="next" type="password" autoComplete="new-password" required />
            </div>
            <Button type="submit" className="w-full">
              Change password
            </Button>
          </form>
          <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
            Changing it signs you out on every other device.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
