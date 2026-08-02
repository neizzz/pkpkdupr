#!/usr/bin/env node

const DEFAULT_TIMEOUT_MS = 5000;

const pkpkduprWebUrl =
  process.env.PKPKDUPR_WEB_URL?.trim() ||
  process.env.PKPKDUPR_SERVER_URL?.trim();
const pkpkduprAdminStackUrl =
  process.env.PKPKDUPR_ADMIN_STACK_URL?.trim() ||
  process.env.PKPKDUPR_SERVER_URL?.trim();
const pkeloWebUrl = process.env.PKELO_WEB_URL?.trim();
const pkeloAdminStackUrl = process.env.PKELO_ADMIN_STACK_URL?.trim();
const pkeloNoticeExpectedMessage = process.env.PKELO_NOTICE_EXPECTED_MESSAGE?.trim();
const requestedApps = (process.env.HEALTHCHECK_APPS?.trim() || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const timeoutMs = Number.parseInt(
  process.env.HEALTHCHECK_TIMEOUT_MS ?? `${DEFAULT_TIMEOUT_MS}`,
  10,
);

const fail = (message) => {
  console.error(`❌ ${message}`);
  process.exitCode = 1;
};

const requestedAppSet = new Set(
  requestedApps.length > 0
    ? requestedApps.includes("all")
      ? ["pkpkdupr", "pkelo"]
      : requestedApps
    : pkeloWebUrl || pkeloAdminStackUrl
      ? ["pkpkdupr", "pkelo"]
      : ["pkpkdupr"],
);

for (const appName of requestedAppSet) {
  if (appName !== "pkpkdupr" && appName !== "pkelo") {
    fail("HEALTHCHECK_APPS는 pkpkdupr, pkelo, all만 허용합니다.");
    process.exit();
  }
}

if (
  requestedAppSet.has("pkpkdupr") &&
  (!pkpkduprWebUrl || !pkpkduprAdminStackUrl)
) {
  fail(
    "PKPKDUPR_WEB_URL 및 PKPKDUPR_ADMIN_STACK_URL 환경변수가 필요합니다.",
  );
  process.exit();
}

if (
  requestedAppSet.has("pkelo") &&
  (!pkeloWebUrl || !pkeloAdminStackUrl)
) {
  fail(
    "pkelo.app 검증에는 PKELO_WEB_URL과 PKELO_ADMIN_STACK_URL을 함께 설정해야 합니다.",
  );
  process.exit();
}

if (pkeloNoticeExpectedMessage && !requestedAppSet.has("pkelo")) {
  fail("PKELO_NOTICE_EXPECTED_MESSAGE는 pkelo 검증에서만 사용할 수 있습니다.");
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

const readText = async (response) => response.text();

const verifyPage = async (
  response,
  {
    expectedText,
    forbiddenTexts = ["404 not found", "notfound"],
  } = {},
) => {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} 응답`);
  }

  const body = (await readText(response)).toLowerCase();

  if (
    forbiddenTexts.some(
      (forbiddenText) =>
        forbiddenText && body.includes(forbiddenText.toLowerCase()),
    )
  ) {
    throw new Error(`페이지 본문에 오류 마커가 포함되었습니다: ${body.slice(0, 160)}`);
  }

  if (expectedText && !body.includes(expectedText.toLowerCase())) {
    throw new Error(`기대 텍스트를 찾지 못했습니다: ${expectedText}`);
  }
};

const normalChecks = [
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
    verify: async (response) => verifyPage(response),
  },
  {
    name: "Admin web",
    target: "admin",
    path: "/admin/",
    verify: async (response) => verifyPage(response),
  },
  {
    name: "Adminer",
    target: "admin",
    path: "/db/",
    verify: async (response) => verifyPage(response, { expectedText: "adminer" }),
  },
];

const noticeChecks = [
  {
    name: "Notice state",
    target: "admin",
    path: "/api/runtime-notice",
    verify: async (response) => {
      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status} 응답`);
      }
      const body = await readJson(response);
      if (body.enabled !== true) {
        throw new Error(`enabled가 true가 아닙니다: ${JSON.stringify(body)}`);
      }
      if (
        pkeloNoticeExpectedMessage &&
        body.message !== pkeloNoticeExpectedMessage
      ) {
        throw new Error(
          `안내 문구가 일치하지 않습니다: ${JSON.stringify(body.message)}`,
        );
      }
    },
  },
  {
    name: "Notice web",
    target: "web",
    path: "/",
    verify: async (response) => verifyPage(response),
  },
  {
    name: "Notice admin route",
    target: "admin",
    path: "/admin/",
    verify: async (response) => verifyPage(response),
  },
  {
    name: "Blocked API",
    target: "admin",
    path: "/api/health",
    verify: async (response) => {
      if (response.status !== 503) {
        throw new Error(`HTTP ${response.status} 응답`);
      }
      if (response.headers.get("x-pkelo-notice")?.toLowerCase() !== "active") {
        throw new Error("X-Pkelo-Notice: active 헤더가 없습니다.");
      }
      const body = await readJson(response);
      if (body.code !== "PKELO_NOTICE_ACTIVE") {
        throw new Error(`안내 API 응답이 아닙니다: ${JSON.stringify(body)}`);
      }
    },
  },
];

const buildAppTargets = () => {
  const targets = [];

  if (requestedAppSet.has("pkpkdupr")) {
    targets.push({
      name: "PkpkDupr",
      webBaseUrl: normalizeBaseUrl(pkpkduprWebUrl),
      adminStackBaseUrl: normalizeBaseUrl(pkpkduprAdminStackUrl),
    });
  }

  if (requestedAppSet.has("pkelo")) {
    targets.push({
      name: "pkelo.app",
      webBaseUrl: normalizeBaseUrl(pkeloWebUrl),
      adminStackBaseUrl: normalizeBaseUrl(pkeloAdminStackUrl),
      noticeMode: Boolean(pkeloNoticeExpectedMessage),
    });
  }

  return targets;
};

const run = async () => {
  let appTargets;
  try {
    appTargets = buildAppTargets();
  } catch (error) {
    throw new Error(
      `healthy check URL이 올바르지 않습니다: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  console.log(`⏱️  Timeout: ${timeoutMs}ms`);

  for (const appTarget of appTargets) {
    console.log(
      `🔎 ${appTarget.name} healthy check: web=${appTarget.webBaseUrl}, admin=${appTarget.adminStackBaseUrl}`,
    );

    const checks = appTarget.noticeMode ? noticeChecks : normalChecks;
    for (const check of checks) {
      const baseUrl =
        check.target === "web"
          ? appTarget.webBaseUrl
          : appTarget.adminStackBaseUrl;
      const url = resolveUrl(baseUrl, check.path);
      const startedAt = Date.now();

      try {
        const response = await fetchWithTimeout(url, { method: "GET" });
        await check.verify(response);
        console.log(
          `✅ ${appTarget.name} ${check.name} (${check.path}) - ${Date.now() - startedAt}ms`,
        );
      } catch (error) {
        throw new Error(
          `${appTarget.name} ${check.name} (${url}) 실패: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  console.log("🎉 모든 healthy check가 통과했습니다.");
};

run().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
