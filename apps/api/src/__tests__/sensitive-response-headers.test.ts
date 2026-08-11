import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  sensitiveResponseHeaders,
  sensitiveRoutes,
} from "../middleware/sensitiveResponseHeaders";

const requestPathFor = (pathname: RegExp) =>
  pathname
    .source
    .replace(/^\^|\$$/g, "")
    .replace(/\\\//g, "/")
    .replace("[^/]+", "player-001");

const app = express();
app.use(sensitiveResponseHeaders);
app.all("*", (req, res) => {
  if (req.query.error === "1") {
    res.status(400).json({ error: "expected error" });
    return;
  }
  res.status(200).json({ ok: true });
});

describe("민감 인증 응답 헤더", () => {
  for (const route of sensitiveRoutes) {
    const path = requestPathFor(route.pathname);

    it(`${route.method} ${path}의 성공·오류 응답을 저장하지 않는다`, async () => {
      const requestWithMethod = request(app)[
        route.method.toLowerCase() as "get"
      ];
      const success = await requestWithMethod(path);
      const failure = await requestWithMethod(`${path}?error=1`);

      expect(success.headers["cache-control"]).toBe("no-store");
      expect(failure.headers["cache-control"]).toBe("no-store");
      expect(success.status).toBe(200);
      expect(failure.status).toBe(400);

      if (route.noReferrer) {
        expect(success.headers["referrer-policy"]).toBe("no-referrer");
        expect(failure.headers["referrer-policy"]).toBe("no-referrer");
      } else {
        expect(success.headers["referrer-policy"]).toBeUndefined();
        expect(failure.headers["referrer-policy"]).toBeUndefined();
      }
    });
  }

  it("민감하지 않은 응답에는 캐시 정책을 추가하지 않는다", async () => {
    const response = await request(app).get("/api/health");

    expect(response.headers["cache-control"]).toBeUndefined();
  });
});
