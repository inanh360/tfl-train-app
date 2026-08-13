import type { MetadataRoute } from "next";

// TfL line ids this app covers — kept as a plain list here rather than a
// live API call, since a sitemap should be fast and doesn't need to be
// perfectly real time.
const LINE_IDS = [
  "bakerloo",
  "central",
  "circle",
  "district",
  "hammersmith-city",
  "jubilee",
  "metropolitan",
  "northern",
  "piccadilly",
  "victoria",
  "waterloo-city",
  "dlr",
  "elizabeth",
  "liberty",
  "lioness",
  "mildmay",
  "suffragette",
  "weaver",
  "windrush",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://linestatus.co.uk";

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, changeFrequency: "always", priority: 1 },
    { url: `${baseUrl}/journey`, changeFrequency: "always", priority: 0.8 },
    { url: `${baseUrl}/departures`, changeFrequency: "always", priority: 0.8 },
    { url: `${baseUrl}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];

  const linePages: MetadataRoute.Sitemap = LINE_IDS.map((id) => ({
    url: `${baseUrl}/${id}`,
    changeFrequency: "always",
    priority: 0.7,
  }));

  return [...staticPages, ...linePages];
}
