import { useEffect, useRef, useState } from "react";

const DEFAULT_MINIMUM_LOADING_MS = 300;

export const useMinimumLoading = (
  isLoading: boolean,
  minimumDurationMs = DEFAULT_MINIMUM_LOADING_MS,
) => {
  const [isMinimumLoading, setIsMinimumLoading] = useState(isLoading);
  const startedAtRef = useRef<number | null>(isLoading ? Date.now() : null);

  useEffect(() => {
    if (isLoading) {
      startedAtRef.current ??= Date.now();
      setIsMinimumLoading(true);
      return undefined;
    }

    if (startedAtRef.current === null) {
      setIsMinimumLoading(false);
      return undefined;
    }

    const remainingDuration = Math.max(
      0,
      minimumDurationMs - (Date.now() - startedAtRef.current),
    );
    const timeoutId = window.setTimeout(() => {
      startedAtRef.current = null;
      setIsMinimumLoading(false);
    }, remainingDuration);

    return () => window.clearTimeout(timeoutId);
  }, [isLoading, minimumDurationMs]);

  return isMinimumLoading;
};
