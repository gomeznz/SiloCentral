import { getCurrentUser } from "@/lib/auth";
import { currentLevels, levelsToCsv } from "@/lib/report-data";

// "Download CSV" on the Sites page: the current level of every silo on every
// site, for a signed-in user. (Outside parties use /api/v1/levels with an API
// key instead.) The proxy only checks that a session cookie exists; this checks
// it's a real session.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  const csv = levelsToCsv(await currentLevels(null), true);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="silocentral-levels-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
