import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const UPDATE_CHECK_TIMEOUT_MS = 2500;
const UPDATE_APPLY_TIMEOUT_MS = 5000;
const UPDATE_PREPARE_ERROR_MESSAGE =
  "업데이트 기능을 준비하지 못했습니다. 잠시 후 다시 시도해주세요.";
const UPDATE_APPLY_ERROR_MESSAGE =
  "새 버전을 적용하지 못했습니다. 잠시 후 다시 시도해주세요.";

export type AppUpdateCheckResult = "update-available" | "up-to-date";

interface AppUpdateContextValue {
  appVersion: string;
  isUpdateAvailable: boolean;
  isCheckingForUpdate: boolean;
  isApplyingUpdate: boolean;
  checkForUpdate: () => Promise<AppUpdateCheckResult>;
  applyUpdate: () => Promise<void>;
}

const AppUpdateContext = createContext<AppUpdateContextValue | null>(null);

const waitForControllerChange = () =>
  new Promise<boolean>((resolve) => {
    let isSettled = false;
    let timeoutId = 0;

    const cleanup = () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange,
      );
      window.clearTimeout(timeoutId);
    };

    const complete = (didChange: boolean) => {
      if (isSettled) {
        return;
      }

      isSettled = true;
      cleanup();
      resolve(didChange);
    };

    const handleControllerChange = () => {
      complete(true);
    };

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange,
    );
    timeoutId = window.setTimeout(() => complete(false), UPDATE_APPLY_TIMEOUT_MS);
  });

const waitForUpdateAvailability = (registration: ServiceWorkerRegistration) =>
  new Promise<boolean>((resolve) => {
    const hadController = Boolean(navigator.serviceWorker.controller);
    let isSettled = false;
    let installingWorker: ServiceWorker | null = null;
    let timeoutId = 0;

    const cleanup = () => {
      registration.removeEventListener("updatefound", handleUpdateFound);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange,
      );
      if (installingWorker) {
        installingWorker.removeEventListener(
          "statechange",
          handleInstallingStateChange,
        );
      }
      window.clearTimeout(timeoutId);
    };

    const complete = (value: boolean) => {
      if (isSettled) {
        return;
      }

      isSettled = true;
      cleanup();
      resolve(value);
    };

    const handleControllerChange = () => {
      if (hadController) {
        complete(true);
      }
    };

    const handleInstallingStateChange = () => {
      if (!installingWorker || !hadController) {
        return;
      }

      if (registration.waiting) {
        complete(true);
        return;
      }

      if (
        installingWorker.state === "installed" ||
        installingWorker.state === "activating" ||
        installingWorker.state === "activated"
      ) {
        complete(true);
        return;
      }

      if (installingWorker.state === "redundant") {
        complete(false);
      }
    };

    const attachInstallingWorker = (worker: ServiceWorker | null) => {
      if (!worker || worker === installingWorker) {
        return;
      }

      if (installingWorker) {
        installingWorker.removeEventListener(
          "statechange",
          handleInstallingStateChange,
        );
      }

      installingWorker = worker;
      installingWorker.addEventListener(
        "statechange",
        handleInstallingStateChange,
      );
      handleInstallingStateChange();
    };

    const handleUpdateFound = () => {
      attachInstallingWorker(registration.installing);
    };

    if (registration.waiting && hadController) {
      complete(true);
      return;
    }

    registration.addEventListener("updatefound", handleUpdateFound);
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange,
    );
    attachInstallingWorker(registration.installing);

    timeoutId = window.setTimeout(() => complete(false), UPDATE_CHECK_TIMEOUT_MS);
  });

const postSkipWaitingMessage = (registration: ServiceWorkerRegistration) => {
  registration.waiting?.postMessage({ type: "SKIP_WAITING" });
};

export const AppUpdateProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const isCheckingForUpdateRef = useRef(false);
  const isApplyingUpdateRef = useRef(false);
  const pendingReloadRef = useRef(false);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [isCheckingForUpdate, setIsCheckingForUpdate] = useState(false);
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    void navigator.serviceWorker.ready
      .then((registration) => {
        registrationRef.current = registration;
      })
      .catch((error: unknown) => {
        console.error("Failed to prepare service worker", error);
      });
  }, []);

  const markUpdateAvailable = useCallback(() => {
    pendingReloadRef.current = true;
    setIsUpdateAvailable(true);
  }, []);

  const clearUpdateAvailable = useCallback(() => {
    pendingReloadRef.current = false;
    setIsUpdateAvailable(false);
  }, []);

  const checkForUpdate = useCallback(async (): Promise<AppUpdateCheckResult> => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      throw new Error("이 환경에서는 업데이트 확인을 지원하지 않습니다.");
    }

    if (!navigator.onLine) {
      throw new Error("오프라인에서는 업데이트를 확인할 수 없습니다.");
    }

    if (isCheckingForUpdateRef.current) {
      throw new Error("업데이트를 확인 중입니다. 잠시만 기다려주세요.");
    }

    isCheckingForUpdateRef.current = true;
    setIsCheckingForUpdate(true);

    try {
      const registration =
        registrationRef.current ?? (await navigator.serviceWorker.getRegistration());

      if (!registration) {
        throw new Error(UPDATE_PREPARE_ERROR_MESSAGE);
      }

      registrationRef.current = registration;

      if (registration.waiting && navigator.serviceWorker.controller) {
        markUpdateAvailable();
        return "update-available";
      }

      const updateAvailablePromise = waitForUpdateAvailability(registration);
      await registration.update();
      const hasUpdate = await updateAvailablePromise;

      if (hasUpdate) {
        markUpdateAvailable();
        return "update-available";
      }

      clearUpdateAvailable();
      return "up-to-date";
    } catch (error) {
      throw error instanceof Error
        ? error
        : new Error("업데이트 확인에 실패했습니다.");
    } finally {
      isCheckingForUpdateRef.current = false;
      setIsCheckingForUpdate(false);
    }
  }, [clearUpdateAvailable, markUpdateAvailable]);

  const applyUpdate = useCallback(async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      throw new Error("이 환경에서는 업데이트 적용을 지원하지 않습니다.");
    }

    if (isApplyingUpdateRef.current) {
      throw new Error("업데이트를 적용 중입니다. 잠시만 기다려주세요.");
    }

    if (!pendingReloadRef.current && !isUpdateAvailable) {
      throw new Error("적용할 새 버전이 없습니다.");
    }

    isApplyingUpdateRef.current = true;
    setIsApplyingUpdate(true);

    try {
      const registration =
        registrationRef.current ?? (await navigator.serviceWorker.getRegistration());

      if (!registration) {
        throw new Error(UPDATE_PREPARE_ERROR_MESSAGE);
      }

      registrationRef.current = registration;

      if (registration.waiting) {
        const waitForReload = waitForControllerChange();
        postSkipWaitingMessage(registration);
        const didChange = await waitForReload;
        if (!didChange) {
          throw new Error(UPDATE_APPLY_ERROR_MESSAGE);
        }
      }

      clearUpdateAvailable();
      window.location.reload();
    } catch (error) {
      throw error instanceof Error
        ? error
        : new Error("업데이트 적용에 실패했습니다.");
    } finally {
      isApplyingUpdateRef.current = false;
      setIsApplyingUpdate(false);
    }
  }, [clearUpdateAvailable, isUpdateAvailable]);

  const value = useMemo<AppUpdateContextValue>(
    () => ({
      appVersion: __APP_VERSION__,
      isUpdateAvailable,
      isCheckingForUpdate,
      isApplyingUpdate,
      checkForUpdate,
      applyUpdate,
    }),
    [
      applyUpdate,
      checkForUpdate,
      isApplyingUpdate,
      isCheckingForUpdate,
      isUpdateAvailable,
    ],
  );

  return (
    <AppUpdateContext.Provider value={value}>
      {children}
    </AppUpdateContext.Provider>
  );
};

export const useAppUpdate = () => {
  const context = useContext(AppUpdateContext);

  if (!context) {
    throw new Error("useAppUpdate must be used within AppUpdateProvider");
  }

  return context;
};
