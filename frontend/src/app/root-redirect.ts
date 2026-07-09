export function handleRootRedirect(
  status: "initializing" | "authenticated" | "unauthenticated",
  replace: (path: string) => void
): void {
  if (status === "authenticated") {
    replace("/app");
  } else if (status === "unauthenticated") {
    replace("/login");
  }
}
