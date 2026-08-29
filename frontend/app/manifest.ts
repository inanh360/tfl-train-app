import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Line Status",
    short_name: "Line Status",
    description:
      "Check live London Underground line statuses, delays, disruptions and departures. Plan your journey and see the latest information for every Tube line.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0c0a",
    theme_color: "#4d5ec2",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
