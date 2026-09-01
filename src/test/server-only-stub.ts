/**
 * Stands in for the `server-only` package under Vitest.
 *
 * The real package throws on import from anywhere but a Server Component,
 * which is exactly what should happen in a build — it is how a module holding
 * cookies or secrets is stopped from being pulled into the client bundle. It
 * also makes every such module impossible to unit-test.
 *
 * Aliased in `vitest.config.ts` only. The real package is still what Next
 * resolves, so the guard it provides is intact where it matters.
 */
export {};
