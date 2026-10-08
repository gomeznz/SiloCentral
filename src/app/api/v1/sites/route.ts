import { apiJson, authenticateCustomer } from "@/lib/customer-auth";
import { listSites } from "@/lib/report-data";

// The sites this key may read, and whether each is online. Light enough to
// poll; the silos themselves are under /api/v1/levels.
export async function GET(request: Request) {
  const auth = await authenticateCustomer(request);
  if (auth instanceof Response) return auth;

  return apiJson({ generatedAt: new Date().toISOString(), sites: await listSites(auth.siteIds) });
}
