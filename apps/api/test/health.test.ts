import { describe, expect, it } from "vitest";
import { buildServer } from "../src/server.js";
import { loadConfig } from "../src/config.js";

describe("health route", () => {
  it("returns a typed health response", async () => {
    const app = await buildServer(
      loadConfig({
        NODE_ENV: "test"
      })
    );

    const response = await app.inject({
      method: "GET",
      url: "/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      service: "snapquote-api"
    });
  });
});
