import type { NextFunction, Request, Response } from "express";

type SensitiveRoute = {
  method: string;
  pathname: RegExp;
  noReferrer?: boolean;
};

const sensitiveRoutes: readonly SensitiveRoute[] = [
  { method: "GET", pathname: /^\/auth\/kakao\/login$/ },
  { method: "POST", pathname: /^\/api\/auth\/kakao\/start$/ },
  {
    method: "GET",
    pathname: /^\/auth\/kakao\/callback$/,
    noReferrer: true,
  },
  { method: "POST", pathname: /^\/api\/auth\/kakao\/exchange$/ },
  { method: "GET", pathname: /^\/api\/auth\/session$/ },
  { method: "GET", pathname: /^\/api\/me$/ },
  { method: "PATCH", pathname: /^\/api\/me\/preferences$/ },
  { method: "GET", pathname: /^\/api\/me\/withdrawal-eligibility$/ },
  { method: "POST", pathname: /^\/api\/me\/withdrawal$/ },
  { method: "POST", pathname: /^\/api\/me\/privacy-policy-consent$/ },
  { method: "POST", pathname: /^\/api\/admin\/login$/ },
  { method: "POST", pathname: /^\/api\/register$/ },
  { method: "POST", pathname: /^\/api\/login$/ },
  { method: "POST", pathname: /^\/api\/change-password$/ },
  {
    method: "POST",
    pathname: /^\/api\/admin\/players\/[^/]+\/password-reset$/,
  },
  {
    method: "DELETE",
    pathname: /^\/api\/admin\/matches\/[^/]+$/,
  },
];

const findSensitiveRoute = (req: Request) =>
  sensitiveRoutes.find(
    (route) => route.method === req.method && route.pathname.test(req.path),
  );

/** 인증 비밀 또는 토큰을 처리하는 응답이 브라우저·중간 캐시에 저장되지 않게 합니다. */
export const sensitiveResponseHeaders = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const route = findSensitiveRoute(req);
  if (route) {
    res.setHeader("Cache-Control", "no-store");
    if (route.noReferrer) {
      res.setHeader("Referrer-Policy", "no-referrer");
    }
  }
  next();
};

export { sensitiveRoutes };
