import type { NextFunction, Request, Response } from "express";

const passwordRequestPaths = new Set([
  "/api/register",
  "/api/login",
  "/api/change-password",
]);

const normalizePath = (path: string) => path.replace(/\/+$/, "") || "/";

export const isPasswordRequest = (req: Pick<Request, "method" | "path">) => {
  const path = normalizePath(req.path);

  if (req.method === "POST" && passwordRequestPaths.has(path)) {
    return true;
  }

  if (
    req.method === "POST" &&
    /^\/api\/admin\/players\/[^/]+\/password-reset$/.test(path)
  ) {
    return true;
  }

  return (
    req.method === "DELETE" &&
    /^\/api\/admin\/matches\/[^/]+$/.test(path)
  );
};

/** 비밀번호 또는 토큰을 다루는 응답은 브라우저와 중간 프록시에 저장하지 않는다. */
export const sensitiveResponseHeaders = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (isPasswordRequest(req)) {
    res.set("Cache-Control", "no-store");
  }
  next();
};
