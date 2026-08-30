import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Nothing personal is behind these paths for a crawler to reach,
      // favourites/notifications/account all redirect to /login when
      // logged out, so there's no real data to accidentally expose, but
      // there's also no reason to have search engines index them.
      disallow: ["/favourites", "/notifications", "/account", "/login", "/auth"],
    },
    sitemap: "https://linestatus.co.uk/sitemap.xml",
  };
}
