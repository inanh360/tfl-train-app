import "dotenv/config";
import express from "express";
import cors from "cors";
import { linesRouter } from "./routes/lines";
import { favouritesRouter } from "./routes/favourites";
import { notificationsRouter } from "./routes/notifications";

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/lines", linesRouter);
app.use("/favourites", favouritesRouter);
app.use("/notifications", notificationsRouter);

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
  console.log(`Run "npm run poll" in a separate process to start the TfL status poller.`);
});
