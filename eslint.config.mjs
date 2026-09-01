import next from "eslint-config-next";
import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/**
 * eslint-config-next 16 ships flat config directly, so it is spread in rather
 * than wrapped in FlatCompat (which cannot serialise the plugin graph and
 * throws on a circular reference).
 */
const config = [
  ...next,
  ...coreWebVitals,
  ...typescript,

  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts"],
  },

  /**
   * The architecture guard.
   *
   * The rule that keeps redesigns cheap is that presentation holds no data
   * access: every component in `shared/ui` and `entities/*​/ui` is pure
   * props-in, and all fetching lives in hooks a container wires up. That is
   * only true for as long as it is enforced, so it is enforced here rather
   * than by discipline.
   */
  {
    files: ["src/shared/ui/**/*.{ts,tsx}", "src/entities/*/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@tanstack/react-query",
              message:
                "Presentational components must not fetch. Move the query into a hook and pass the data in as props.",
            },
            {
              name: "zustand",
              message:
                "Presentational components must not read stores. Pass the value in as a prop.",
            },
          ],
          patterns: [
            {
              group: ["@/app/providers/*", "@/features/*", "@/widgets/*"],
              message:
                "Layer violation: shared/ui and entities/*/ui may only import from shared/. Anything above them must be passed in as props.",
            },
          ],
        },
      ],
    },
  },

  /**
   * Layer direction for the rest of the tree. A layer may import from those
   * below it and never from those above.
   */
  {
    files: ["src/shared/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/app/*", "@/widgets/*", "@/features/*", "@/entities/*"],
              message: "shared/ is the bottom layer and must not import from above it.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/entities/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/app/*", "@/widgets/*", "@/features/*"],
              message: "entities/ may only import from shared/.",
            },
          ],
        },
      ],
    },
  },

  {
    // Fixtures deliberately hold long literal content.
    files: ["src/shared/fixtures/**/*.ts"],
    rules: { "no-restricted-imports": "off" },
  },
];

export default config;
