const normalizeBaseUrl = (value: string | undefined) =>
  value ? value.replace(/\/+$/, "") : "";

const resolveApiBaseUrl = () => {
  const configuredBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL);
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  if (import.meta.env.DEV || typeof window === "undefined") {
    return "";
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

  return `${API_BASE_URL}${path}`;
};

export const buildPublicAuthUrl = (path: string) => {
  if (!path.startsWith("/")) {
    throw new Error(`Public auth path must start with '/': ${path}`);
  }

  if (import.meta.env.DEV || typeof window === "undefined") {
    return path;
  }

  return `${window.location.origin}${path}`;
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
