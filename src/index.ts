import "dotenv/config";
import express from "express";
import cors from "cors";
import { linesRouter } from "./routes/lines";
import { favouritesRouter } from "./routes/favourites";
import { notificationsRouter } from "./routes/notifications";
import { stationsRouter } from "./routes/stations";
import { journeyRouter } from "./routes/journey";
import { accountRouter } from "./routes/account";
import { nearbyRouter } from "./routes/nearby";
import { generalLimiter, tflProxyLimiter } from "./middleware/rateLimiters";

const app = express();
const PORT = process.env.PORT ?? 4000;

// Caddy sits in front of this in production and adds an X-Forwarded-For
// header with the real client IP. Without telling Express to trust that,
// express-rate-limit can't safely tell users apart by IP and throws a
// validation error on every request. "1" means trust exactly one hop
// (Caddy), not an arbitrary chain of proxies.
app.set("trust proxy", 1);

// In dev this defaults to allowing any origin. Once deployed, set
// FRONTEND_URL in your Railway env vars to your Vercel domain so only your
// own frontend can call this API.
const corsOrigin = process.env.FRONTEND_URL ?? true;
app.use(cors({ origin: corsOrigin }));
app.use(express.json());
app.use(generalLimiter);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/lines", linesRouter);
app.use("/favourites", favouritesRouter);
app.use("/notifications", notificationsRouter);
app.use("/stations", tflProxyLimiter, stationsRouter);
app.use("/journey", tflProxyLimiter, journeyRouter);
app.use("/nearby", tflProxyLimiter, nearbyRouter);
app.use("/account", accountRouter);

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
  console.log(`Run "npm run poll" in a separate process to start the TfL status poller.`);
});
