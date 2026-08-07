import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a self-contained .next/standalone folder with only the files
  // needed to run — keeps the Docker image small and avoids shipping the
  // full node_modules tree into the runtime stage.
  output: "standalone",

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Stops the site being embedded in an iframe on another domain,
          // which blocks clickjacking-style attacks.
          { key: "X-Frame-Options", value: "DENY" },
          // Stops the browser guessing content types in a way that can
          // enable certain XSS attacks.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Limits how much of the current URL gets sent as a referrer
          // when a user clicks a link away from the site.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Turns off browser features this app has no use for, so they
          // can't be abused even if something else went wrong.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // 'unsafe-inline' here is a known, deliberate relaxation —
              // Next.js embeds a small inline script for page hydration
              // data. A stricter nonce-based CSP is possible but needs
              // per-request middleware, which is a bigger change than
              // fits here without real risk of breaking the build.
              "script-src 'self' 'unsafe-inline'",
              // Inline style={{...}} props (used throughout this app)
              // render as real HTML style attributes, which need this to
              // keep working.
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data:",
              "font-src 'self'",
              // Allows both the real deployed API and localhost, so this
              // same build works whether you're testing locally or it's
              // actually live.
              "connect-src 'self' https://api.linestatus.co.uk http://localhost:4000 https://*.supabase.co",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
