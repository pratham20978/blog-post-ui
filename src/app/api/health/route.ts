/**
 * Container liveness only. Route handlers do not render layouts, so this probe
 * cannot resolve a session, call the backend, or create an anonymous actor.
 */
export function GET() {
  return new Response(null, {
    status: 204,
    headers: { "cache-control": "no-store" },
  });
}
