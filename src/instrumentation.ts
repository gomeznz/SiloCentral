// Runs once when the server starts, before it accepts requests.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { seedInitialAdmin } = await import("./lib/seed-admin");
  await seedInitialAdmin();
}
