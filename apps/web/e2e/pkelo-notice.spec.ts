import { expect, test, type Page, type Route } from "@playwright/test";

const expectStableBrandPosition = async (
  page: Page,
  response: { enabled: boolean; title?: string; message?: string },
) => {
  let releaseNoticeRequest: (() => void) | undefined;
  const noticeRequestPending = new Promise<void>((resolve) => {
    releaseNoticeRequest = resolve;
  });

  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ authenticated: false }),
    }),
  );
  await page.route("**/api/runtime-notice", async (route: Route) => {
    await noticeRequestPending;
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(response),
    });
  });

  await page.goto("http://pkelo.localhost:4173/login");

  const brand = page.getByAltText("PKELO 피클볼 로고");
  await expect(brand).toBeVisible();
  const positionBeforeNoticeResponse = await brand.boundingBox();

  const noticeResponse = page.waitForResponse("**/api/runtime-notice");
  expect(releaseNoticeRequest).toBeDefined();
  releaseNoticeRequest?.();
  await noticeResponse;

  await expect(brand).toBeVisible();
  await expect
    .poll(() => brand.boundingBox())
    .toEqual(positionBeforeNoticeResponse);
};

test("공지 확인 후 로그인 버튼이 표시되어도 브랜드 위치가 유지된다", async ({
  page,
}) => {
  await expectStableBrandPosition(page, { enabled: false });
  await expect(page.getByRole("button", { name: "카카오 로그인" })).toBeVisible();
});

test("공지 확인 후 안내가 표시되어도 브랜드 위치가 유지된다", async ({
  page,
}) => {
  await expectStableBrandPosition(page, {
    enabled: true,
    title: "서비스 점검 안내",
    message: "잠시 후 다시 이용해주세요.",
  });
  await expect(page.getByRole("heading", { name: "서비스 점검 안내" })).toBeVisible();
});
