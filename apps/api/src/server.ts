import { pathToFileURL } from "node:url";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { healthResponseSchema } from "@snapquote/shared";
import { loadConfig, type AppConfig } from "./config.js";
import { v1Routes } from "./routes/v1.js";

const version = "0.1.0";

export async function buildServer(config: AppConfig = loadConfig()) {
  const app = Fastify({
    logger: config.NODE_ENV !== "test"
  });

  await app.register(cors, {
    origin: true
  });

  app.get("/health", () =>
    healthResponseSchema.parse({
      ok: true,
      service: "snapquote-api",
      version,
      timestamp: new Date().toISOString()
    })
  );

  await app.register(v1Routes, {
    prefix: "/v1"
  });

  return app;
}

async function start() {
  const config = loadConfig();
  const app = await buildServer(config);

  await app.listen({
    host: "0.0.0.0",
    port: config.PORT
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  start().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
