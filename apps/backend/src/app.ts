import type { Health } from "@repo/shared";
import cors from "cors";
import express, { type Express } from "express";
import { createV1Router } from "./api/v1/routes/index.js";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";

export async function createApp(): Promise<Express> {
  const app = express();

  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json());

  // Unversioned on purpose: liveness probes shouldn't care about API versions.
  app.get("/health", (_req, res) => {
    const body: Health = {
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
    res.json(body);
  });

  app.use("/api/v1", await createV1Router());

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
