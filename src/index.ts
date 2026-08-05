import "dotenv/config";
import express from "express";
import cors from "cors";
import { linesRouter } from "./routes/lines";
import { favouritesRouter } from "./routes/favourites";
import { notificationsRouter } from "./routes/notifications";
import { stationsRouter } from "./routes/stations";
import { journeyRouter } from "./routes/journey";

const app = express();
const PORT = process.env.PORT ?? 4000;

// In dev this defaults to allowing any origin. Once deployed, set
// FRONTEND_URL in your Railway env vars to your Vercel domain so only your
// own frontend can call this API.
const corsOrigin = process.env.FRONTEND_URL ?? true;
app.use(cors({ origin: corsOrigin }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/lines", linesRouter);
app.use("/favourites", favouritesRouter);
app.use("/notifications", notificationsRouter);
app.use("/stations", stationsRouter);
app.use("/journey", journeyRouter);

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
  console.log(`Run "npm run poll" in a separate process to start the TfL status poller.`);
});
