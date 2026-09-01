"use client";

/**
 * The last resort: a failure in the root layout itself, before providers,
 * fonts or global CSS are mounted.
 *
 * It replaces the whole document — hence its own <html> and <body> — and is
 * styled inline, because the stylesheet is exactly one of the things that may
 * have failed to load.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          textAlign: "center",
          background: "#ffffff",
          color: "#0a0a0a",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ maxWidth: "28rem" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>
            Something went wrong
          </h1>
          <p style={{ marginTop: "0.75rem", color: "#6b6b6b", lineHeight: 1.6 }}>
            The application failed to start. Reloading may resolve it.
          </p>
          {error.digest && (
            <p style={{ marginTop: "1rem", fontFamily: "monospace", fontSize: "0.8125rem", color: "#6b6b6b" }}>
              Reference: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              padding: "0.6rem 1.25rem",
              background: "#0a0a0a",
              color: "#ffffff",
              border: 0,
              borderRadius: 2,
              cursor: "pointer",
              font: "inherit",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
