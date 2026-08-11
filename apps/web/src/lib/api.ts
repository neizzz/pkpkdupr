const normalizeBaseUrl = (value: string | undefined) =>
  value ? value.replace(/\/+$/, "") : "";

const isLoopbackHostname = (hostname: string) => {
  const normalizedHostname = hostname.replace(/^\[|\]$/g, "");
  return (
    normalizedHostname === "localhost" ||
    normalizedHostname === "127.0.0.1" ||
    normalizedHostname === "::1"
  );
};

const assertSecureProductionUrl = (value: string, label: string) => {
  if (import.meta.env.DEV || typeof window === "undefined") {
    return;
  }

  let url: URL;
  try {
    url = new URL(value, window.location.origin);
  } catch {
    throw new Error(`${label} URL이 올바르지 않습니다.`);
  }

  if (url.protocol === "https:" || isLoopbackHostname(url.hostname)) {
    return;
  }

  throw new Error(`${label} 요청은 운영 환경에서 HTTPS를 사용해야 합니다.`);
};

const isPkeloPublicHost = () =>
  typeof window !== "undefined" && window.location.hostname === "pkelo.app";

const resolveApiBaseUrl = () => {
  const configuredBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL);
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  if (import.meta.env.DEV || typeof window === "undefined") {
    return "";
  }

  if (isPkeloPublicHost()) {
    return window.location.origin;
  }

  const apiUrl = new URL(window.location.origin);
  apiUrl.port = import.meta.env.VITE_API_PORT?.trim() || "3333";
  return apiUrl.origin;
};

const API_BASE_URL = resolveApiBaseUrl();

export const buildApiUrl = (path: string) => {
  if (!path.startsWith("/")) {
    throw new Error(`API path must start with '/': ${path}`);
  }

  const apiUrl = `${API_BASE_URL}${path}`;
  assertSecureProductionUrl(apiUrl, "API");
  return apiUrl;
};

export const buildPublicAuthUrl = (path: string) => {
  if (!path.startsWith("/")) {
    throw new Error(`Public auth path must start with '/': ${path}`);
  }

  if (import.meta.env.DEV || typeof window === "undefined") {
    return path;
  }

  const publicAuthUrl = `${window.location.origin}${path}`;
  assertSecureProductionUrl(publicAuthUrl, "Kakao 로그인");
  return publicAuthUrl;
};

export const resolveAssetUrl = (value?: string | null) => {
  if (!value) {
    return value ?? undefined;
  }

  if (/^(?:https?:)?\/\//i.test(value) || value.startsWith("data:")) {
    return value;
  }

  if (value.startsWith("/uploads/")) {
    return buildApiUrl(value);
  }

  return value;
};
