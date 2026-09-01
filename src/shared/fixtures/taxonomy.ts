import type { Category, Series } from "@/shared/contracts";

/**
 * Fixtures mirror real payload shapes exactly — same field names, same null
 * versus absent, same id format (UUIDv7 strings). Screens built against them
 * therefore need no changes when the API is connected; only the source of the
 * data changes.
 */

export const categories: readonly Category[] = [
  { key: "engineering", label: "Engineering", description: "How the system is built." },
  { key: "research", label: "Research", description: "Work in progress." },
  { key: "infrastructure", label: "Infrastructure", description: "What it runs on." },
  { key: "product", label: "Product", description: "What we chose to build." },
  { key: "open-source", label: "Open Source", description: null },
];

export const series: readonly Series[] = [
  {
    id: "0198f0e2-3b7a-7c31-9f52-000000000001",
    key: "foundations",
    title: "Foundations",
    description:
      "The decisions underneath everything else — contracts, identity, and the shape of the data.",
  },
  {
    id: "0198f0e2-3b7a-7c31-9f52-000000000002",
    key: "retrieval",
    title: "Retrieval",
    description: "Search and ranking without reaching for embeddings.",
  },
  {
    id: "0198f0e2-3b7a-7c31-9f52-000000000003",
    key: "operating-the-platform",
    title: "Operating the Platform",
    description: "Running it in production. Starts soon.",
  },
];
