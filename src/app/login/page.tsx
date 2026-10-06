import { redirect } from "next/navigation";
import { loginAction } from "../auth-actions";
import { getCurrentUser } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoginBackdrop } from "@/components/login-backdrop";
import { SiloCentralLogo } from "@/components/silocentral-logo";
import { Label } from "@/components/ui/label";

// Depends on the visitor's cookie, so it can't be prerendered.
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  if (await getCurrentUser()) {
    redirect(safeNext(next));
  }

  return (
    <div className="mx-auto w-full max-w-sm p-8 pt-12">
      <LoginBackdrop />
      <SiloCentralLogo className="mb-8" />
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <form action={loginAction} className="space-y-4">
            <input type="hidden" name="next" value={safeNext(next)} />

            {error && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input id="username" name="username" autoComplete="username" autoCapitalize="none" required autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" autoComplete="current-password" required />
            </div>
            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
