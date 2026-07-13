import type { Health } from "@repo/shared";
import express, { type Express } from "express";
import { GRAPHQL_PATH, createYogaServer } from "./api/v1/graphql/yoga";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";

export async function createApp(): Promise<Express> {
  const app = express();
  const yoga = await createYogaServer();

  // Unversioned on purpose: liveness probes shouldn't track API versions.
  app.get("/health", (_req, res) => {
    const body: Health = {
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
    res.json(body);
  });

  // `app.all`, not `app.use`: mounting strips the prefix from req.url, which
  // would leave Yoga unable to match its own graphqlEndpoint. GET is included
  // so GraphiQL is served from the same path in dev.
  //
  // This also runs ahead of express.json() deliberately — Yoga reads the raw
  // body itself, and a body parser here would consume the stream first.
  app.all(GRAPHQL_PATH, (req, res) => yoga(req, res));

  app.use(express.json());
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
