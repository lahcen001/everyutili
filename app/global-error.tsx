"use client";

// Replaces the root layout when it crashes, so there is no i18n provider or global CSS here — plain English fallback.
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "4rem 1rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Something went wrong</h1>
        <p style={{ color: "#6b7280", margin: "0.75rem 0 1.5rem" }}>
          An unexpected error occurred. Your files were not uploaded anywhere.
        </p>
        <button
          onClick={() => retry()}
          style={{ padding: "0.5rem 1rem", border: "1px solid #d1d5db", borderRadius: "0.5rem", cursor: "pointer" }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
