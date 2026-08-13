import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { app } from "../index";

const originalRuntimeNoticeFile = process.env.PKELO_RUNTIME_NOTICE_FILE;
let temporaryDirectory: string | undefined;

const useTemporaryNoticeFile = async () => {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), "pkelo-runtime-notice-"));
  const noticeFile = path.join(temporaryDirectory, "notice.json");
  process.env.PKELO_RUNTIME_NOTICE_FILE = noticeFile;
  return noticeFile;
};

afterEach(async () => {
  if (originalRuntimeNoticeFile === undefined) {
    delete process.env.PKELO_RUNTIME_NOTICE_FILE;
  } else {
    process.env.PKELO_RUNTIME_NOTICE_FILE = originalRuntimeNoticeFile;
  }

  if (temporaryDirectory) {
    await rm(temporaryDirectory, { force: true, recursive: true });
    temporaryDirectory = undefined;
  }
});

describe("GET /api/runtime-notice", () => {
  it("활성 안내를 no-store 응답으로 반환한다", async () => {
    const noticeFile = await useTemporaryNoticeFile();
    await writeFile(
      noticeFile,
      JSON.stringify({
        enabled: true,
        title: " PKELO 안내 ",
        message: " 점검 중입니다. ",
      }),
    );

    const response = await request(app).get("/api/runtime-notice");

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body).toEqual({
      enabled: true,
      title: "PKELO 안내",
      message: "점검 중입니다.",
    });
  });

  it("비활성 안내를 반환한다", async () => {
    const noticeFile = await useTemporaryNoticeFile();
    await writeFile(noticeFile, JSON.stringify({ enabled: false }));

    const response = await request(app).get("/api/runtime-notice");

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body).toEqual({ enabled: false });
  });

  it("안내 파일이 없으면 비활성 안내를 반환한다", async () => {
    await useTemporaryNoticeFile();

    const response = await request(app).get("/api/runtime-notice");

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body).toEqual({ enabled: false });
  });

  it("손상되거나 유효하지 않은 활성 안내는 비활성으로 처리한다", async () => {
    const noticeFile = await useTemporaryNoticeFile();
    await writeFile(noticeFile, "{");

    const malformedResponse = await request(app).get("/api/runtime-notice");
    expect(malformedResponse.status).toBe(200);
    expect(malformedResponse.headers["cache-control"]).toBe("no-store");
    expect(malformedResponse.body).toEqual({ enabled: false });

    await writeFile(noticeFile, JSON.stringify({ enabled: true, title: "PKELO" }));

    const invalidResponse = await request(app).get("/api/runtime-notice");
    expect(invalidResponse.status).toBe(200);
    expect(invalidResponse.headers["cache-control"]).toBe("no-store");
    expect(invalidResponse.body).toEqual({ enabled: false });
  });
});
