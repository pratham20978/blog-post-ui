import type { BlogId, CatalogId, CommentId, KeyStr } from "@/shared/contracts";

/**
 * Every backend path, in one place.
 *
 * Nothing outside this file builds an API URL from string pieces. When a route
 * moves, it moves here and the compiler finds each caller.
 *
 * These are paths *relative to the API prefix*. The BFF proxy prepends its own
 * base for browser calls, and the server client prepends the backend origin.
 */
export const routes = {
  // ── Public reads ────────────────────────────────────────────────────────
  blogs: () => "/blogs",
  blog: (slug: KeyStr) => `/blogs/${encodeURIComponent(slug)}`,
  blogContent: (slug: KeyStr) => `/blogs/${encodeURIComponent(slug)}/content`,
  blogSections: (slug: KeyStr) => `/blogs/${encodeURIComponent(slug)}/sections`,
  blogReferences: (slug: KeyStr) => `/blogs/${encodeURIComponent(slug)}/references`,
  categories: () => "/categories",
  series: () => "/series",

  // ── Auth ────────────────────────────────────────────────────────────────
  otpRequest: () => "/auth/otp/request",
  otpVerify: () => "/auth/otp/verify",
  oauthStart: (provider: string) => `/auth/oauth/${encodeURIComponent(provider)}/start`,
  oauthCallback: (provider: string) => `/auth/oauth/${encodeURIComponent(provider)}/callback`,
  refresh: () => "/auth/refresh",
  revoke: () => "/auth/revoke",
  me: () => "/auth/me",

  // ── Engagement ──────────────────────────────────────────────────────────
  engagement: () => "/engagement",
  recentViews: () => "/me/recent",

  // ── Comments ────────────────────────────────────────────────────────────
  // Note these take a blog *id*, not a slug — unlike every read route above.
  // Resolve slug to id via `BlogDetail` first.
  comments: (blogId: BlogId) => `/blogs/${encodeURIComponent(blogId)}/comments`,
  comment: (commentId: CommentId) => `/comments/${encodeURIComponent(commentId)}`,

  // ── Markers ─────────────────────────────────────────────────────────────
  marker: (blogId: BlogId) => `/blogs/${encodeURIComponent(blogId)}/marker`,
  markers: () => "/me/markers",

  // ── Catalogs ────────────────────────────────────────────────────────────
  catalogs: () => "/me/catalogs",
  catalogItems: (catalogId: CatalogId) =>
    `/me/catalogs/${encodeURIComponent(catalogId)}/items`,
  catalogItem: (catalogId: CatalogId, blogId: BlogId) =>
    `/me/catalogs/${encodeURIComponent(catalogId)}/items/${encodeURIComponent(blogId)}`,
  saves: () => "/me/saves",
} as const;

/**
 * Where the browser sends API calls. The BFF route handler at this path adds
 * the access and actor tokens from httpOnly cookies, which the browser cannot
 * read and therefore cannot add itself.
 */
export const BFF_BASE = "/api/bff";

/** Next.js routes owned by the frontend, not proxied to the backend. */
export const localRoutes = {
  /** Clears the session cookies. */
  signOut: () => "/api/auth/sign-out",
  /** Exchanges an OTP code for cookies. */
  otpVerify: () => "/api/auth/otp-verify",
  /** Who the caller is, in sample mode. The API path uses the BFF instead. */
  session: () => "/api/auth/me",
  /** What to read after an article. Also read directly by the article page,
   *  which is server-rendered and does not need the hop. */
  nextBlog: (slug: string) => `/api/blogs/${encodeURIComponent(slug)}/next`,
} as const;
