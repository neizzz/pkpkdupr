import type { NextFunction, Request, Response } from "express";
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from "prom-client";

type RouteAwareRequest = Request & {
  route?: {
    path?: string | string[];
  };
};

const metricsRegistry = new Registry();

collectDefaultMetrics({ register: metricsRegistry });

const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests handled by the API",
  labelNames: ["method", "route", "status_code"] as const,
  registers: [metricsRegistry],
});

const httpRequestDurationSeconds = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.2, 0.5, 1, 2, 5],
  registers: [metricsRegistry],
});

const httpRequestsInFlight = new Gauge({
  name: "http_requests_in_flight",
  help: "Current number of in-flight HTTP requests",
  registers: [metricsRegistry],
});

const normalizeRoutePath = (
  baseUrl: string | undefined,
  routePath: string,
): string => {
  const normalizedBaseUrl =
    baseUrl && baseUrl !== "/" ? baseUrl.replace(/\/$/, "") : "";
  const normalizedRoutePath = routePath.startsWith("/")
    ? routePath
    : `/${routePath}`;

  return `${normalizedBaseUrl}${normalizedRoutePath}`;
};

const resolveRouteLabel = (req: RouteAwareRequest): string => {
  const routePath = req.route?.path;

  if (typeof routePath === "string" && routePath.length > 0) {
    return normalizeRoutePath(req.baseUrl, routePath);
  }

  if (Array.isArray(routePath) && routePath.length > 0) {
    const firstRoutePath = routePath[0];
    if (typeof firstRoutePath === "string" && firstRoutePath.length > 0) {
      return normalizeRoutePath(req.baseUrl, firstRoutePath);
    }
  }

  return "unmatched";
};

export const metricsMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const requestPath = req.path;
  if (requestPath === "/metrics") {
    next();
    return;
  }

  const startTime = process.hrtime.bigint();
  let finalized = false;

  httpRequestsInFlight.inc();

  const finalizeMetrics = () => {
    if (finalized) {
      return;
    }
    finalized = true;

    const durationSeconds =
      Number(process.hrtime.bigint() - startTime) / 1_000_000_000;
    const method = req.method.toUpperCase();
    const route = resolveRouteLabel(req as RouteAwareRequest);
    const statusCode = String(res.statusCode);

    httpRequestsTotal.inc({
      method,
      route,
      status_code: statusCode,
    });
    httpRequestDurationSeconds.observe(
      {
        method,
        route,
        status_code: statusCode,
      },
      durationSeconds,
    );
    httpRequestsInFlight.dec();
  };

  res.once("finish", finalizeMetrics);
  res.once("close", finalizeMetrics);

  next();
};

export const getMetricsContentType = () => metricsRegistry.contentType;

export const getMetricsSnapshot = async () => metricsRegistry.metrics();
