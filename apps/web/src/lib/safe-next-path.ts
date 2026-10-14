// Only allow redirects to paths on this site, never to another domain
// (e.g. "//evil.example" or "https://evil.example").
export function safeNextPath(next: string | null, fallback = "/home") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
