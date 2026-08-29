import rateLimit from "express-rate-limit";

// Applies to every route as a baseline. Generous enough that normal use of
// the app never comes close to it, but stops a runaway client or a bot
// from hammering the API indefinitely.
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again shortly." },
});

// Stricter limit for routes that proxy out to TfL's API. These are the
// ones that actually cost something if abused, hammering them burns
// through our TfL app key's own rate limit, which would degrade the app
// for every user, not just the one sending the requests.
export const tflProxyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests to TfL-backed endpoints, please slow down." },
});
