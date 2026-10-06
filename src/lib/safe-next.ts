// Where to send someone after they sign in. It comes from the URL, so it has
// to be a path on THIS site — otherwise a crafted link could bounce a freshly
// signed-in user to an attacker's page ("open redirect"). Anything that isn't
// a plain absolute path falls back to the home page.
export function safeNext(value: unknown): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/")) return "/";
  // "//host" and "/\host" are treated by browsers as another site.
  if (value.startsWith("//") || value.startsWith("/\\")) return "/";
  if (value.startsWith("/login")) return "/";
  return value;
}
