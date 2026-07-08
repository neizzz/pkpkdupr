#!/usr/bin/env node

const DEFAULT_TIMEOUT_MS = 5000;

const webUrlFromEnv =
  process.env.PKPKDUPR_WEB_URL?.trim() ||
  process.env.PKPKDUPR_SERVER_URL?.trim();
const adminStackUrlFromEnv =
  process.env.PKPKDUPR_ADMIN_STACK_URL?.trim() ||
  process.env.PKPKDUPR_SERVER_URL?.trim();
const timeoutMs = Number.parseInt(
  process.env.HEALTHCHECK_TIMEOUT_MS ?? `${DEFAULT_TIMEOUT_MS}`,
  10,
);

const fail = (message) => {
  console.error(`❌ ${message}`);
  process.exitCode = 1;
};

if (!webUrlFromEnv || !adminStackUrlFromEnv) {
  fail(
    "PKPKDUPR_WEB_URL 및 PKPKDUPR_ADMIN_STACK_URL 환경변수가 필요합니다.",
  );
  process.exit();
}

if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  fail("HEALTHCHECK_TIMEOUT_MS는 1 이상의 정수여야 합니다.");
  process.exit();
}

const normalizeBaseUrl = (rawUrl) => {
  const withScheme = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  const url = new URL(withScheme);
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/+$/, "");
};

const resolveUrl = (baseUrl, path) => `${baseUrl}${path}`;

const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "user-agent": "pkpkdupr-healthcheck/1.0",
        ...(options.headers ?? {}),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`${timeoutMs}ms 안에 응답하지 않았습니다.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const readJson = async (response) => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`JSON 응답이 아닙니다: ${text.slice(0, 160)}`);
  }
};

const checks = [
  {
    name: "API health",
    target: "admin",
    path: "/api/health",
    verify: async (response) => {
      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status} 응답`);
      }
      const body = await readJson(response);
      if (body.status !== "ok") {
        throw new Error(`status가 ok가 아닙니다: ${JSON.stringify(body)}`);
      }
    },
  },
  {
    name: "API ping",
    target: "admin",
    path: "/api/ping",
    verify: async (response) => {
      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status} 응답`);
      }
      const body = await readJson(response);
      if (body.message !== "pong") {
        throw new Error(`message가 pong이 아닙니다: ${JSON.stringify(body)}`);
      }
    },
  },
  {
    name: "Web root",
    target: "web",
    path: "/",
    verify: async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} 응답`);
      }
    },
  },
  {
    name: "Admin web",
    target: "admin",
    path: "/admin/",
    verify: async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} 응답`);
      }
    },
  },
  {
    name: "Uptime Kuma",
    target: "admin",
    path: "/uptime/",
    verify: async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} 응답`);
      }
    },
  },
  {
    name: "SQLite Web",
    target: "admin",
    path: "/db/",
    verify: async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} 응답`);
      }
    },
  },
];

const run = async () => {
  let baseUrl;
  let webBaseUrl;
  let adminStackBaseUrl;
  try {
    webBaseUrl = normalizeBaseUrl(webUrlFromEnv);
    adminStackBaseUrl = normalizeBaseUrl(adminStackUrlFromEnv);
  } catch (error) {
    throw new Error(
      `healthy check URL이 올바르지 않습니다: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  console.log(`🔎 PkpkDupr healthy check: web=${webBaseUrl}, admin=${adminStackBaseUrl}`);
  console.log(`⏱️  Timeout: ${timeoutMs}ms`);

  for (const check of checks) {
    const baseUrl = check.target === "web" ? webBaseUrl : adminStackBaseUrl;
    const url = resolveUrl(baseUrl, check.path);
    const startedAt = Date.now();

    try {
      const response = await fetchWithTimeout(url, { method: "GET" });
      await check.verify(response);
      console.log(`✅ ${check.name} (${check.path}) - ${Date.now() - startedAt}ms`);
    } catch (error) {
      throw new Error(
        `${check.name} (${url}) 실패: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  console.log("🎉 모든 healthy check가 통과했습니다.");
};

run().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
