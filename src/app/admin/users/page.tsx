import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { createUserAction, deleteUserAction, resetPasswordAction, setUserRoleAction } from "../../user-actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocalDateTime } from "@/components/local-date-time";

export const dynamic = "force-dynamic";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const me = await requireAdmin();
  const { error, ok } = await searchParams;

  const allUsers = await db.select().from(users).orderBy(asc(users.username));

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Admins can open Setup and manage users. Viewers can only see the dashboards, so use a viewer account
            for a customer.
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
          <CardTitle>Add a user</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <form action={createUserAction} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-username">Username</Label>
              <Input id="new-username" name="username" autoCapitalize="none" autoComplete="off" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">Password (10+ characters)</Label>
              <Input id="new-password" name="password" type="password" autoComplete="new-password" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-role">Role</Label>
              <Select id="new-role" name="role" defaultValue="viewer">
                <option value="viewer">Viewer</option>
                <option value="admin">Admin</option>
              </Select>
            </div>
            <Button type="submit" className="sm:col-span-3">
              Add user
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users ({allUsers.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          {allUsers.map((user) => (
            <div key={user.id} className="space-y-3 rounded-md border border-slate-200 p-3 text-sm dark:border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="font-medium">{user.username}</span>
                  {user.id === me.id && <span className="ml-2 text-xs text-slate-400">(you)</span>}
                  <div className="text-xs text-slate-400 dark:text-slate-500">
                    {user.lastLoginAt ? (
                      <>
                        Last signed in <LocalDateTime value={user.lastLoginAt} />
                      </>
                    ) : (
                      "Never signed in"
                    )}
                  </div>
                </div>
                <form action={setUserRoleAction} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={user.id} />
                  <Select name="role" defaultValue={user.role} aria-label={`Role for ${user.username}`} className="h-8 w-auto">
                    <option value="viewer">Viewer</option>
                    <option value="admin">Admin</option>
                  </Select>
                  <Button type="submit" size="sm" variant="outline">
                    Save role
                  </Button>
                </form>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <form action={resetPasswordAction} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={user.id} />
                  <Input
                    name="password"
                    type="password"
                    placeholder="New password"
                    autoComplete="new-password"
                    aria-label={`New password for ${user.username}`}
                    required
                    className="h-8 w-48"
                  />
                  <Button type="submit" size="sm" variant="outline">
                    Reset password
                  </Button>
                </form>
                {user.id !== me.id && (
                  <form action={deleteUserAction}>
                    <input type="hidden" name="id" value={user.id} />
                    <Button type="submit" size="sm" variant="destructive">
                      Delete
                    </Button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
