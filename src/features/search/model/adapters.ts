import { BFF_BASE } from "@/shared/api/routes";
import type { SearchAdapterKind } from "@/shared/config";
import type { APIResponse, BlogSummary, Category, Page, Series } from "@/shared/contracts";

import { newQueryId, type SearchHit, type SearchPort, type SearchResults } from "./port";

/** What the mock needs to search over. Supplied by the caller so the adapter
 *  holds no state of its own and is trivial to test. */
export interface SearchCorpus {
  readonly blogs: readonly BlogSummary[];
  readonly categories: readonly Category[];
  readonly series: readonly Series[];
}

const WEIGHTS = { title: 3, summary: 2, category: 1, series: 1 } as const;

/** Lowercase and strip accents, so "café" is found by typing "cafe". */
function normalise(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function tokenise(query: string): readonly string[] {
  return normalise(query)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1);
}

/**
 * Client-side search over the already-fetched feed.
 *
 * Honest about what it is: substring matching across title, summary, category
 * label and series title, scored so the ordering is deliberate. For a catalog
 * of this size that is genuinely useful, and it costs no round trip.
 *
 * Every token must match somewhere (AND, not OR) — with OR, a two-word query
 * returns everything that matched either word, which reads as broken.
 */
export function createMockSearchAdapter(getCorpus: () => SearchCorpus): SearchPort {
  return {
    async search(query: string): Promise<SearchResults> {
      const tokens = tokenise(query);
      if (tokens.length === 0) return { hits: [], queryId: newQueryId() };

      const { blogs, categories, series } = getCorpus();
      const categoryLabels = new Map(categories.map((c) => [c.key, c.label]));
      const seriesTitles = new Map(series.map((s) => [s.id, s.title]));

      const hits: SearchHit[] = [];

      for (const blog of blogs) {
        const fields = {
          title: normalise(blog.title),
          summary: normalise(blog.summary ?? ""),
          category: normalise(
            blog.category_keys.map((key) => categoryLabels.get(key) ?? key).join(" "),
          ),
          series: normalise(blog.series_id ? (seriesTitles.get(blog.series_id) ?? "") : ""),
        } as const;

        let score = 0;
        const matchedOn = new Set<SearchHit["matchedOn"][number]>();

        const everyTokenMatches = tokens.every((token) => {
          let matchedThisToken = false;
          for (const [field, text] of Object.entries(fields)) {
            if (!text.includes(token)) continue;
            matchedThisToken = true;
            const key = field as keyof typeof WEIGHTS;
            matchedOn.add(key);
            // A hit at a word boundary counts double: "read" matching
            // "reading" is weaker evidence than matching "read".
            const boundary = new RegExp(`\\b${token}`).test(text);
            score += WEIGHTS[key] * (boundary ? 2 : 1);
          }
          return matchedThisToken;
        });

        if (everyTokenMatches) {
          hits.push({ blog, score, matchedOn: [...matchedOn] });
        }
      }

      hits.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        // Recency breaks ties, matching how the feed itself is ordered.
        return (b.blog.published_at ?? "").localeCompare(a.blog.published_at ?? "");
      });

      return { hits, queryId: newQueryId() };
    },
  };
}

/**
 * The real adapter, for when `GET /api/v1/search` exists.
 *
 * Written now so the swap is a config change, not a code change. It is not
 * reachable unless `NEXT_PUBLIC_SEARCH_ADAPTER=http`, and it will 404 until
 * the endpoint ships.
 */
export function createHttpSearchAdapter(): SearchPort {
  return {
    async search(query: string, signal?: AbortSignal): Promise<SearchResults> {
      const url = new URL(`${BFF_BASE}/search`, window.location.origin);
      url.searchParams.set("q", query);

      const response = await fetch(url, { signal, headers: { accept: "application/json" } });
      const body = (await response.json()) as APIResponse<Page<BlogSummary>>;

      const items = body.data?.items ?? [];
      return {
        // The server ranks; preserving its order is the whole point of
        // switching to it, so every hit gets the same nominal score.
        hits: items.map((blog) => ({ blog, score: 1, matchedOn: [] })),
        queryId: newQueryId(),
      };
    },
  };
}

export function createSearchAdapter(
  kind: SearchAdapterKind,
  getCorpus: () => SearchCorpus,
): SearchPort {
  return kind === "http" ? createHttpSearchAdapter() : createMockSearchAdapter(getCorpus);
}
