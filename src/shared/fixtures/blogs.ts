import type { BlogContent, BlogDetail, BlogSection, BlogSummary } from "@/shared/contracts";

/**
 * Sample content for Canerly's own engineering blog.
 *
 * Fixtures mirror real payload shapes exactly — same field names, same null
 * versus absent, same id format (UUIDv7 strings) — so screens built against
 * them need no changes when the API is connected. Only the source changes.
 *
 * Every article here has a real body. An article whose content is missing
 * renders the "could not be loaded" notice, which is correct behaviour for a
 * storage failure and misleading as a demo.
 */

const AUTHOR = "0198f0e2-3b7a-7c31-9f52-0000000000aa";

const FOUNDATIONS = "0198f0e2-3b7a-7c31-9f52-000000000001";
const RETRIEVAL = "0198f0e2-3b7a-7c31-9f52-000000000002";

function id(n: number): string {
  return `0198f0e2-3b7a-7c31-9f52-1000000000${n.toString().padStart(2, "0")}`;
}

/* ── Sections, derived the way the backend derives them ──────────────────
 *
 * The real `sections` come from `blog_sections`, written by the publish
 * pipeline. Hand-writing them here would let the fixture anchors drift from
 * the fixture headings, and a table of contents that points at nothing is
 * exactly the bug `rehypeBackendAnchors` exists to prevent — so they are
 * derived instead, mirroring `adapters/markdown/parser.py`.
 */

/** Mirror of the backend's `slugify`: ASCII, lowercase, hyphen-separated. */
function slugify(value: string): string {
  return value
    .normalize("NFKD")
    // Strip the combining marks NFKD split off, so "Café" folds to "cafe"
    // rather than losing the letter entirely.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const HEADING = /^(#{1,6})\s+(.+?)\s*$/;
const FENCE = /^\s*(```|~~~)/;

/**
 * Walk the body for ATX headings, skipping fenced code so a `# comment` in a
 * shell sample never becomes a section. Repeated titles get `-2`, `-3` — the
 * same disambiguation the backend applies, and the reason these anchors cannot
 * be re-derived in the browser from heading text alone.
 */
function sectionsFromMarkdown(markdown: string): readonly BlogSection[] {
  const lines = markdown.split("\n");
  const found: { level: number; title: string; charStart: number }[] = [];
  const seen = new Map<string, number>();

  let offset = 0;
  let inFence = false;

  for (const line of lines) {
    if (FENCE.test(line)) inFence = !inFence;
    else if (!inFence) {
      const match = HEADING.exec(line);
      // Both groups are guaranteed by the pattern; the guard is for the
      // type-checker, which cannot know that.
      if (match?.[1] && match[2]) {
        found.push({ level: match[1].length, title: match[2], charStart: offset });
      }
    }
    offset += line.length + 1; // + the newline `split` removed
  }

  return found.map((heading, index) => {
    const base = slugify(heading.title) || `section-${index + 1}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);

    return {
      anchor: count === 1 ? base : `${base}-${count}`,
      ordinal: index,
      level: heading.level,
      title: heading.title,
      char_start: heading.charStart,
      char_end: found[index + 1]?.charStart ?? markdown.length,
    };
  });
}

/* ── Bodies ──────────────────────────────────────────────────────────────
 * Frontmatter already stripped, as the publish pipeline stores it. Only one
 * opens with an image, so both the derived-cover and the typographic-cover
 * paths are exercised by the feed.
 */

const bodies: Readonly<Record<string, string>> = {
  "introducing-canerly": `Canerly is a place to publish long-form writing, built on one decision that
everything else follows from: the article *is* a Markdown file. Not a row with
a Markdown column, not a document that was Markdown before an editor got to it.
The file is the source of truth, and every other thing the platform knows is
derived from it.

## What Canerly is

A writer commits a Markdown file. The publish pipeline parses it, extracts the
headings, counts the words, hashes the body, and stores the bytes unchanged in
object storage. The database holds what you need to *find* an article. The
object store holds the article.

That split is the whole design. It means the rendered page can always be thrown
away and rebuilt, and it means there is exactly one representation to keep
honest.

## The three decisions

Most of what is interesting about the platform comes from three choices made
early, each of which closed off a category of bug rather than solving one.

| Decision | What it buys |
| --- | --- |
| Markdown is the only stored form | One representation, a meaningful ETag |
| Readers have an identity before an account | History that survives signup |
| Errors are a closed set | Failure handling becomes a lookup |

### Markdown is the only representation

There is no rendered copy in the database, and no cached HTML that can fall out
of step with the source. The body hashes to a \`content_sha256\`, which becomes
the ETag, so a conditional request is answered without reading the object at
all:

\`\`\`python
class ContractModel(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        frozen=True,
        validate_assignment=True,
    )
\`\`\`

> Storing a second representation is storing a second thing that can be wrong.

Headings are the one exception, and they are stored *alongside* the body rather
than derived from it at read time — because reading positions and cross-article
references point at anchors, and those anchors have to survive a re-render.
[Markdown all the way down](/blogs/markdown-all-the-way-down) covers why.

## What is not built yet

Being honest about the edges is cheaper than discovering them later:

1. Email delivery. Codes are generated, but nothing sends them yet.
2. Full-text search. The index exists; the query path does not.
3. Tags. The vocabulary is not settled, and a field stored under a definition
   nobody agreed on looks authoritative to whoever finds it next.

None of these are hard. They are simply not done, and the platform says so
rather than pretending otherwise.
`,

  "retrieval-without-embeddings": `![A ranking pipeline: query understanding, candidate generation, linear rerank](/media/retrieval-pipeline.png)

Reaching for a vector database is the default move, and for a corpus of a few
thousand documents it is usually the wrong one.

## The problem

Embeddings buy you conceptual matching. They cost you an index to maintain, a
model to version, and a retrieval path nobody on the team can debug by reading
it. For Canerly's own archive — a few hundred articles — that trade is plainly
bad.

## What we used instead

Three stages, each of which a person can inspect:

1. **Query understanding.** Normalise, drop stop words, keep the rare terms.
2. **Candidate generation.** Full-text match, unioned with trigram similarity
   so a typo still finds the article.
3. **Rerank.** A linear model over six features. All six are readable.

The reranker is the part people expect to be complicated. It is not:

\`\`\`sql
SELECT id,
       ts_rank(search_vector, query) * 2.0
     + similarity(title, :q)         * 1.5
     + recency_decay(published_at)   * 0.5 AS score
FROM blogs, plainto_tsquery('english', :q) query
WHERE search_vector @@ query
ORDER BY score DESC
LIMIT 20;
\`\`\`

## When embeddings do win

At a corpus size where lexical recall genuinely falls apart, or when the
queries and the documents share no vocabulary — support tickets against
engineering docs, say. Neither is true here.

The honest summary: start lexical, measure the misses, and add the vector path
when you can name the queries it would fix.
`,

  "the-cost-of-a-vector-database": `A vector database is not expensive because of what it charges. It is expensive
because of what it obliges you to keep doing.

## What you actually pay for

The invoice is the small part. The real costs are:

- **A model version.** Re-embedding a corpus is a migration, and it is one you
  cannot do incrementally without keeping both models alive.
- **An index to keep warm.** Recall degrades quietly as the index drifts.
- **A second source of truth.** Now the article exists in two places, and one
  of them is a lossy projection of the other.

## When it is worth paying

When conceptual recall is the product rather than a nicety. Semantic search
over a large, messy, vocabulary-mismatched corpus is a real problem and vectors
are a real answer to it.

For an archive you can list on one page, the answer is [full-text and a linear
reranker](/blogs/retrieval-without-embeddings).

## The rule we settled on

> Add the index when you can name three queries it fixes that the current path
> gets wrong.

Not "when the corpus grows", not "when search feels slow" — three named
queries. It is a low bar and it has still not been met here.
`,

  "errors-are-a-contract": `Failure handling goes wrong in a predictable way: every call site invents its
own interpretation of what went wrong, and the interpretations disagree.

## A closed set

Canerly's API has one error shape and a closed enumeration of categories. Every
category maps to exactly one HTTP status, in one table, and nothing else in the
system decides a status.

\`\`\`python
HTTP_STATUS_BY_ERROR_CATEGORY: Final[Mapping[ErrorCategory, int]] = {
    ErrorCategory.BLOG_NOT_FOUND: 404,
    ErrorCategory.VALIDATION_FAILED: 400,
    ErrorCategory.AUTH_REQUIRED: 401,
    ErrorCategory.RATE_LIMITED: 429,
}
\`\`\`

## Why the client branches on category

Status codes are too coarse to act on. A 400 could be a malformed body, a
rejected field, or a request that is well-formed but not allowed yet — and the
right response differs in each case.

| Category | What the UI does |
| --- | --- |
| \`BLOG_NOT_FOUND\` | Render the not-found screen |
| \`VALIDATION_FAILED\` | Attach messages to the named fields |
| \`AUTH_REQUIRED\` | Prompt to sign in, preserving the return path |
| \`RATE_LIMITED\` | Count down, disable submit |

### Validation is 400, not 422

422 is reserved for the semantically impossible — a request that parsed, made
sense, and still cannot be honoured. A rejected field is not that. Keeping the
two apart means a 422 in the logs is always worth reading.

## What it costs

One thing: the enumeration can only grow, and removing a member is a breaking
change. That has been worth it every time.
`,

  "keyset-pagination": `On an append-heavy table, page two is not what it was a second ago.

## The drift

\`OFFSET 20\` means "skip the first twenty rows of the result *as it is now*".
Publish an article between the two requests and every row shifts down by one:
the reader sees the last item of page one again at the top of page two, and
never sees the item that got pushed across the boundary.

It is not a race condition in the usual sense. Nothing is corrupted. The reader
simply gets a slightly wrong list, quietly, and only on a busy table.

## Cursors

A keyset cursor encodes the sort key of the last row you saw, and the next
query asks for rows strictly after it:

\`\`\`sql
SELECT id, slug, title, published_at
FROM blogs
WHERE status = 'published'
  AND (published_at, id) < (:last_published_at, :last_id)
ORDER BY published_at DESC, id DESC
LIMIT :limit;
\`\`\`

The tuple comparison is doing the real work. Sorting on \`published_at\` alone
is ambiguous when two articles share a timestamp, and the id breaks the tie
deterministically.

### It gets faster, not slower

\`OFFSET 10000\` makes the database produce ten thousand rows and throw them
away. The keyset query seeks straight into the index and reads the page. Deep
pagination costs the same as shallow pagination.

## What you give up

Page numbers. There is no "jump to page 7", and no total count without a second
query. For a feed nobody was going to page 7 of, that is not a loss — and the
API is honest about it: the response is \`{items, next_cursor, has_more}\`, with
no \`total\` to tempt anyone.
`,

  "identity-before-the-account": `Most platforms start a reader's history at signup. Everything before that — the
articles they read while deciding whether to sign up — is discarded, which is
exactly the period you would most like to understand.

## Actors

Canerly issues every visitor a server-generated actor id on their first
request, and returns it as a token the client echoes back on every subsequent
one. No account, no email, no consent dialog, because it identifies a session
lineage rather than a person.

Reading history, positions, and engagement events all attach to the actor.

## Merge on signup

When the visitor eventually creates an account, the actor is not thrown away —
it is merged into the new user, and everything they read beforehand comes with
them.

> The reader who signs up on their fourth article should find the first three
> waiting for them.

The merge is the part worth getting right. It runs once, inside the transaction
that creates the user, and it is idempotent: replaying it cannot duplicate
history.

## The failure mode to avoid

Dropping the actor token on a single request mints a *new* actor, silently. The
visitor's history forks, and the merge at signup finds only the fragment from
whichever branch they happened to be on.

So the token is echoed on every request and re-read from every response, and
the proxy that does it is the only place that touches it.
`,

  "one-comment-per-person": `The rule was simple: one top-level comment per person per article. Replies are
unlimited; the opening statement is not.

## Checking it in the service

The first implementation did what you would expect — read, decide, write:

\`\`\`python
existing = await repo.find_root_comment(blog_id, author_id)
if existing is not None:
    raise BlogPlatformError(ErrorCategory.COMMENT_ALREADY_EXISTS)
await repo.insert(comment)
\`\`\`

This is wrong under concurrency, and it is wrong in the boring way: two
requests both read "no existing comment" before either writes.

## Making it unrepresentable

The database can express the rule directly, as a partial unique index over
root comments only:

\`\`\`sql
CREATE UNIQUE INDEX one_root_comment_per_author
    ON comments (blog_id, author_id)
 WHERE parent_id IS NULL
   AND deleted_at IS NULL;
\`\`\`

The service now attempts the insert and translates a unique violation into the
same error category it used to raise by hand. The check did not move — it
stopped being a check.

## The general shape

If a rule is invariant, put it where invariants live. A constraint in the
schema is enforced against every writer, including the migration you run at
2am and the script nobody remembered was still in cron.
`,

  "markdown-all-the-way-down": `Canerly stores the Markdown source and never a rendered copy. Not as a
purity exercise — it removes a class of bug that is otherwise permanent.

## Two representations, one of them wrong

The moment you cache rendered HTML alongside the source, you own a
synchronisation problem. Change the renderer and every cached copy is stale.
Fix a sanitiser bug and the vulnerable HTML is still sitting in the cache.

There is no version of this that stays correct without a re-render pass you
have to remember to run.

## What the hash buys

The body hashes to a \`content_sha256\` at publish time. That hash is the ETag,
so a conditional request is answered without touching the object store:

\`\`\`http
GET /api/v1/blogs/markdown-all-the-way-down/content
If-None-Match: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"

304 Not Modified
\`\`\`

It is a *strong* ETag, and it can be, because it is a hash of the exact bytes
served rather than a timestamp that approximates them.

### Headings are the exception

Section anchors are stored in the database, not derived at render time. They
have to be: reading positions and cross-references point at them through a
foreign key, so an anchor that changed because the renderer changed would break
a reference that was valid yesterday.

## The one cost

Rendering happens per request. It is a few milliseconds for an article of this
size, and it buys a system where the source is the only thing that can be
wrong.
`,
};

/**
 * The feed, newest first — the order the backend's `blogs_feed` index returns.
 *
 * Deliberately mixed: some articles belong to a series and some do not, one
 * series has nothing published (so it derives as "upcoming"), and titles vary
 * in length so the card layouts are exercised rather than flattered.
 */
export const blogSummaries: readonly BlogSummary[] = [
  {
    id: id(9),
    slug: "introducing-canerly",
    title: "Introducing Canerly",
    summary:
      "A publishing platform where the article is a Markdown file, the reader has an identity before an account, and every failure has a name.",
    status: "published",
    series_id: null,
    series_position: null,
    category_keys: ["product", "engineering"],
    word_count: 1904,
    reading_minutes: 8,
    published_at: "2026-08-18T09:00:00Z",
    updated_at: "2026-08-18T09:00:00Z",
  },
  {
    id: id(8),
    slug: "retrieval-without-embeddings",
    title: "Retrieval Without Embeddings",
    summary:
      "Full-text search, trigram matching and a linear reranker get you further than the vector-first reflex suggests.",
    status: "published",
    series_id: RETRIEVAL,
    series_position: 2,
    category_keys: ["research", "engineering"],
    word_count: 2380,
    reading_minutes: 10,
    published_at: "2026-08-11T09:00:00Z",
    updated_at: "2026-08-12T14:20:00Z",
  },
  {
    id: id(7),
    slug: "the-cost-of-a-vector-database",
    title: "The Cost of a Vector Database",
    summary: "What you actually pay for, and when it is worth paying.",
    status: "published",
    series_id: RETRIEVAL,
    series_position: 1,
    category_keys: ["infrastructure"],
    word_count: 1428,
    reading_minutes: 6,
    published_at: "2026-08-04T09:00:00Z",
    updated_at: "2026-08-04T09:00:00Z",
  },
  {
    id: id(6),
    slug: "errors-are-a-contract",
    title: "Errors Are a Contract",
    summary:
      "A closed set of error categories, each mapped to one status, turns failure handling from guesswork into a lookup.",
    status: "published",
    series_id: FOUNDATIONS,
    series_position: 3,
    category_keys: ["engineering"],
    word_count: 1666,
    reading_minutes: 7,
    published_at: "2026-07-28T09:00:00Z",
    updated_at: "2026-07-28T09:00:00Z",
  },
  {
    id: id(5),
    slug: "keyset-pagination",
    title: "Keyset Pagination, and Why OFFSET Drifts",
    summary:
      "On an append-heavy table, page two is not what it was a second ago. Cursors fix that and get faster as they go deeper.",
    status: "published",
    series_id: FOUNDATIONS,
    series_position: 2,
    category_keys: ["engineering", "infrastructure"],
    word_count: 1190,
    reading_minutes: 5,
    published_at: "2026-07-21T09:00:00Z",
    updated_at: "2026-07-21T09:00:00Z",
  },
  {
    id: id(4),
    slug: "identity-before-the-account",
    title: "Identity Before the Account",
    summary:
      "Giving every visitor a server-issued actor id means reading history exists before signup — and survives it.",
    status: "published",
    series_id: FOUNDATIONS,
    series_position: 1,
    category_keys: ["engineering", "product"],
    word_count: 2142,
    reading_minutes: 9,
    published_at: "2026-07-14T09:00:00Z",
    updated_at: "2026-07-15T11:00:00Z",
  },
  {
    id: id(3),
    slug: "one-comment-per-person",
    title: "One Comment Per Person",
    summary: "Making a rule unrepresentable in the schema beats checking it in the service.",
    status: "published",
    series_id: null,
    series_position: null,
    category_keys: ["product", "engineering"],
    word_count: 952,
    reading_minutes: 4,
    published_at: "2026-07-07T09:00:00Z",
    updated_at: "2026-07-07T09:00:00Z",
  },
  {
    id: id(2),
    slug: "markdown-all-the-way-down",
    title: "Markdown All the Way Down",
    summary:
      "Storing the source and never a rendered copy keeps one representation honest and the ETag meaningful.",
    status: "published",
    series_id: null,
    series_position: null,
    category_keys: ["engineering", "open-source"],
    word_count: 1309,
    reading_minutes: 6,
    published_at: "2026-06-30T09:00:00Z",
    updated_at: "2026-06-30T09:00:00Z",
  },
];

const summaryBySlug = new Map(blogSummaries.map((summary) => [summary.slug, summary]));

/** A stand-in for the real content hash. Stable per slug, which is all the
 *  ETag path needs from a fixture. */
function fakeHash(slug: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < slug.length; index += 1) {
    hash = Math.imul(hash ^ slug.charCodeAt(index), 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0").repeat(8);
}

export const blogContents: Readonly<Record<string, BlogContent>> = Object.fromEntries(
  Object.entries(bodies).map(([slug, markdown]) => [
    slug,
    {
      blog_id: summaryBySlug.get(slug)?.id ?? id(0),
      slug,
      content_sha256: fakeHash(slug),
      markdown,
    } satisfies BlogContent,
  ]),
);

/** Build a plausible `BlogDetail` for any summary, for screens that need one. */
export function detailFor(summary: BlogSummary): BlogDetail {
  const markdown = bodies[summary.slug] ?? "";

  return {
    ...summary,
    author_id: AUTHOR,
    sections: sectionsFromMarkdown(markdown),
    // An internal object-store URI. Not browser-fetchable — the body comes
    // from the content route. Present because the real contract has it.
    markdown_uri: `s3://blogs/blogs/${summary.id}/${fakeHash(summary.slug)}.md`,
    content_sha256: fakeHash(summary.slug),
    created_at: summary.published_at ?? summary.updated_at,
  };
}
