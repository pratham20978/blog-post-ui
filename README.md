# Canerly — web

The reader-facing UI for the FastAPI backend in `../src/blogs`.

Branding lives in `../brand` (see its README). `shared/ui/Logo.tsx` inlines the
horizontal lockup with `fill="currentColor"` so the mark follows the theme;
the same files are copied to `public/brand/` for anything outside React.

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · TanStack Query · Zustand.

```bash
npm install
npm run dev          # http://localhost:3000
```

It runs standalone. `BLOGS_DATA_SOURCE` defaults to `fixtures`, so every
screen renders from typed sample data with no backend, no database and no
object store. Set it to `api` to read from FastAPI.

| Command | |
| --- | --- |
| `npm run dev` | dev server |
| `npm run build` | production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint, including the layer rules below |
| `npm run test` | Vitest |

## Layout

Feature-Sliced, mirroring the backend's ports-and-adapters so the two read
alike. A layer imports only from layers below it, and ESLint enforces it.

```
src/
  app/            routes; providers/ holds the provider stack
  widgets/        header, footer, article shell
  features/       auth, search, theme, engagement
  entities/       blog, series, category — types, queries, cards
  shared/         contracts, api, ui, lib, config, fixtures
```

**Presentation holds no data access.** Everything in `shared/ui` and
`entities/*/ui` is pure props-in — no fetching, no store reads. Behaviour lives
in hooks; a container wires hook to component. Two consequences, and both are
the point:

- Redesigning means editing `ui/` only. No data path can break.
- Screens built on fixtures are the *final* components. Connecting the API
  changes what feeds them, not what they are.

`shared/ui/tokens.css` holds every colour and type token. Change the palette
there and the whole site follows.

## Providers

Composed once in `app/providers/AppProviders.tsx`. Order is dependency order.

```
ConfigProvider → ThemeProvider → QueryProvider → AuthProvider
  → EngagementProvider → ToastProvider → ErrorBoundary
```

| | |
| --- | --- |
| **Config** | server-read env and flags, passed down as a prop so client code never touches `process.env` |
| **Theme** | `light \| dark \| system` via `useSyncExternalStore`; an inline `<head>` script applies the stored theme before first paint, so there is no flash |
| **Query** | one `QueryClient` per request on the server, one per session in the browser; retries only what the API marked `RETRYABLE` |
| **Auth** | session as a state machine, seeded server-side from `/auth/me` so the header is correct in the first frame. Holds **no tokens** |
| **Engagement** | beacon queue, flushed on `visibilitychange` via `sendBeacon` |
| **Toast** | notification queue with a persistent `aria-live` region |

## Connecting the backend

```bash
# .env.local
BLOGS_DATA_SOURCE=api
BLOGS_API_URL=http://localhost:8000
```

```bash
cd .. && BLOGS_DEBUG=true uv run uvicorn blogs.main:app --reload --port 8000
```

`BLOGS_DEBUG=true` matters for two reasons: CORS middleware is only registered
in debug (`src/blogs/main.py:81`), and it enables the OTP dev log described
below.

### Things about this API worth knowing before you touch it

1. **Two tokens, both headers.** `Authorization: Bearer` (15 min) and
   `X-Actor-Token` (365 days). The actor token must be echoed on every request
   and re-read from every response — drop it and each request mints a new
   anonymous actor, orphaning the visitor's pre-signup history.
2. **Refresh is single-use and rotating.** Replaying a spent refresh token
   revokes the entire token family, so refresh must be single-flight.
3. **`extra="forbid"` on every contract.** An unknown key in a request body is
   a 400, not an ignored field.
4. **Validation failures are 400, not 422.** 422 is reserved for the
   semantically impossible. Branch on `error.category`, never on status.
5. **Reads take a slug, interactions take a `blog_id`.** Comments, markers and
   saves all need the UUID, so resolve it from `BlogDetail` first.
6. **`markdown_uri` is an internal `s3://` URI**, not browser-fetchable. The
   body only comes from `/blogs/{slug}/content`.
7. **Pagination is keyset only.** `{items, next_cursor, has_more}` — no page,
   no offset, no total. Cursors are opaque; never build one.

## Gaps this UI works around

The backend is F3 (`../src/docs/01_core_blog_platform.md`). Three things the
design needs do not exist there, and each is handled explicitly rather than
faked.

**No media field anywhere.** There is no thumbnail, hero or asset column, and
the publish pipeline strips frontmatter before storing, so a `cover:` key would
never survive. Covers are the first `![](…)` image in the Markdown body,
resolved server-side in `fetchCovers` (one cached content fetch per card).
Articles without an image get a generated typographic cover — except the
full-width lead card, which leads with its title instead, because a 1200px slab
of flat colour reads as a failed image rather than as design.

**No search endpoint.** Migration 001 states full-text and trigram search are
out of scope for this phase. Search is a `SearchPort` with two adapters:
`mock` (client-side, scored over the cached feed) and `http` (targets
`GET /api/v1/search`, unused until it exists). Swap with
`NEXT_PUBLIC_SEARCH_ADAPTER`.

**No public trending, featured, or series status.** Trending exists but only
behind the secret admin prefix, and `Series` has no dates or status. The feed's
five rails are derived in `entities/blog/model/selectors.ts` — pure, unit
tested, and the single file to change when a real signal lands.

**No "what to read next".** `nextBlog()` in the same file picks the next part of
the series by `series_position`, falling back to recency and wrapping at the
oldest article so the archive never dead-ends. Navigation is forward only —
there is deliberately no "previous". When a relevance signal exists it replaces
the recency branch there, and both the article page and
`GET /api/blogs/[slug]/next` follow without edits.

## Signing in

**Sample mode** (`BLOGS_DATA_SOURCE=fixtures`, the default): any email address
plus the code `000000` signs you in as a demo reader. The code step is the real
UI and the real route — only the code check and the session are stubbed, in
`features/auth/server/demo-session.ts`.

That stub is gated on fixtures mode and refuses in `api` mode, where the
articles are real and a fixed code would be an unauthenticated sign-in as
anyone. It fails closed rather than falling back, so a misconfigured deployment
cannot accidentally accept it.

## Known limitation: OTP codes cannot be delivered

There is no email adapter — that is F2 (`../src/docs/04_email_pipeline.md`) and
it is unbuilt. `request_otp` writes an outbox event and, **in dev only**, logs
the code:

```
DEV ONLY — OTP for you@example.com is 123456
```

That log is gated by `otp_log_codes`, which production refuses to enable. So
today:

- **Against the real API, OAuth is the only sign-in that works end to end.**
- Email OTP is testable in development by reading the backend's console.
- Email OTP is **not usable in production** until F2 ships.

The UI is built correctly for both paths. The gap is delivery, and it belongs
to the backend.

## Other deliberate omissions

- **Profile is read-only.** There is no `PATCH /me`; `User` is read-only over
  HTTP and `display_name` only ever arrives from an OAuth profile. The page
  says so rather than showing an Edit button that cannot work.
- **No tags.** F4 owns the vocabulary; frontmatter `tags:` is parsed and
  discarded by the backend today.
- **No `/admin-panel`.** Deferred.

## Routes

| | |
| --- | --- |
| `/` | redirects to `/blogs` |
| `/blogs` | feed — featured, trending, current series, upcoming series, all |
| `/blogs/[slug]` | article. `/[slug]/blog` permanently redirects here |
| `/series`, `/series/[key]` | series index and numbered reading path |
| `/login`, `/signup` | one passwordless flow, two framings |
| `/profile` | read-only: continue reading, saved, recently read |
| `/search` | URL-driven results |

Frontend-owned API routes, not proxied to the backend:

| | |
| --- | --- |
| `GET /api/blogs/[slug]/next` | what to read after an article — `{slug, id, title, reason}` |
| `GET /api/auth/me` | the session, sample mode only |
| `POST /api/auth/otp-verify` | exchange a code for a session |
| `POST /api/auth/sign-out` | clear the session cookies |

## One thing not to change

`shared/lib/markdown.tsx` runs `rehype-sanitize` **before**
`rehypeBackendAnchors`. Reversed, the sanitiser rewrites heading ids to
`user-content-<anchor>` as a DOM-clobbering guard, and every table-of-contents
link, deep link and section marker silently points at an element that no longer
carries that id.

The anchors themselves come from `BlogDetail.sections` rather than from
`rehype-slug`, because the backend's slugify disambiguates repeated headings
with `-2`/`-3` suffixes and `reference_pins` has a composite foreign key onto
`(blog_id, anchor)`. Re-deriving ids in the browser would produce anchors that
mostly match and occasionally do not.

Both are covered by tests in `markdown.test.tsx` and
`rehype-backend-anchors.test.ts`.
