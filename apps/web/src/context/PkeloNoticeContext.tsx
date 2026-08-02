import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { buildApiUrl } from "@/lib/api";
import PkeloTemporaryNotice from "@/pages/PkeloTemporaryNotice";

const RUNTIME_NOTICE_PATH = "/api/runtime-notice";
const NOTICE_HEADER = "x-pkelo-notice";
const NOTICE_POLL_INTERVAL_MS = 30_000;
const NOTICE_FETCH_TIMEOUT_MS = 4_000;

type RuntimeNoticeResponse = {
  enabled: boolean;
  title?: string;
  message?: string;
};

export type PkeloNotice = {
  title: string;
  message: string;
};

type PkeloNoticeContextValue = {
  notice: PkeloNotice | null;
  refreshNotice: () => Promise<void>;
};

const PkeloNoticeContext = createContext<PkeloNoticeContextValue | null>(null);

const isPkeloAppHost = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.location.hostname === "pkelo.app" ||
    (import.meta.env.DEV && window.location.hostname === "pkelo.localhost")
  );
};

const parseRuntimeNotice = (value: unknown): PkeloNotice | null => {
  if (!value || typeof value !== "object" || !("enabled" in value)) {
    return null;
  }

  const response = value as RuntimeNoticeResponse;
  if (response.enabled !== true) {
    return null;
  }

  const title = response.title?.trim() || "PKELO";
  const message = response.message?.trim() || "안내 사항을 확인해주세요.";
  return { title, message };
};

const isActiveNoticeResponse = (response: Response) =>
  response.status === 503 &&
  response.headers.get(NOTICE_HEADER)?.toLowerCase() === "active";

const fetchRuntimeNotice = async (): Promise<PkeloNotice | null> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    NOTICE_FETCH_TIMEOUT_MS,
  );

  try {
    const response = await window.fetch(buildApiUrl(RUNTIME_NOTICE_PATH), {
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`안내 상태 요청 실패: HTTP ${response.status}`);
    }

    return parseRuntimeNotice(await response.json());
  } finally {
    window.clearTimeout(timeoutId);
  }
};

export const PkeloNoticeProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [notice, setNotice] = useState<PkeloNotice | null>(null);
  const isPkeloHost = isPkeloAppHost();
  const refreshInFlightRef = useRef<Promise<void> | null>(null);

  const refreshNotice = useCallback(async () => {
    if (!isPkeloHost) {
      return;
    }

    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    const request = fetchRuntimeNotice()
      .then((nextNotice) => {
        setNotice(nextNotice);
      })
      .catch(() => {
        // 오프라인·일시 네트워크 실패에서는 기존 PWA 캐시 사용을 유지합니다.
      })
      .finally(() => {
        refreshInFlightRef.current = null;
      });
    refreshInFlightRef.current = request;
    return request;
  }, [isPkeloHost]);

  useEffect(() => {
    if (!isPkeloHost) {
      return;
    }

    void refreshNotice();

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshNotice();
      }
    };

    window.addEventListener("focus", refreshWhenVisible);
    window.addEventListener("online", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      window.removeEventListener("online", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [isPkeloHost, refreshNotice]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshNotice();
    }, NOTICE_POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [notice, refreshNotice]);

  useEffect(() => {
    if (!isPkeloHost) {
      return;
    }

    const originalFetch = window.fetch.bind(window);
    const observedFetch: typeof window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (isActiveNoticeResponse(response)) {
        void refreshNotice();
      }
      return response;
    };

    window.fetch = observedFetch;
    return () => {
      if (window.fetch === observedFetch) {
        window.fetch = originalFetch;
      }
    };
  }, [isPkeloHost, refreshNotice]);

  const value = useMemo<PkeloNoticeContextValue>(
    () => ({ notice, refreshNotice }),
    [notice, refreshNotice],
  );

  return (
    <PkeloNoticeContext.Provider value={value}>
      {notice ? <PkeloTemporaryNotice {...notice} /> : children}
    </PkeloNoticeContext.Provider>
  );
};

export const usePkeloNotice = () => {
  const context = useContext(PkeloNoticeContext);
  if (!context) {
    throw new Error("usePkeloNotice는 PkeloNoticeProvider 안에서 사용해야 합니다.");
  }
  return context;
};
