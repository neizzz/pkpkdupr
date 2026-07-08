import React, { useCallback, useEffect, useRef, useState } from "react";

interface HoldToConfirmButtonProps {
  onComplete: () => void;
  holdDurationMs?: number;
  children: React.ReactNode;
  className?: string;
  progressClassName?: string;
  isDisabled?: boolean;
  ariaLabel?: string;
}

const HoldToConfirmButton: React.FC<HoldToConfirmButtonProps> = ({
  onComplete,
  holdDurationMs = 800,
  children,
  className,
  progressClassName,
  isDisabled = false,
  ariaLabel,
}) => {
  const [progress, setProgress] = useState(0);
  const animationFrameRef = useRef<number | null>(null);
  const holdStartTimeRef = useRef<number | null>(null);
  const isHoldingRef = useRef(false);
  const isCompletedRef = useRef(false);
  const stepRef = useRef<(timestamp: number) => void>(undefined);

  const cancelAnimation = useCallback(() => {
    if (animationFrameRef.current === null) {
      return;
    }

    window.cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
  }, []);

  const resetHold = useCallback(() => {
    cancelAnimation();
    holdStartTimeRef.current = null;
    isHoldingRef.current = false;
    isCompletedRef.current = false;
    setProgress(0);
  }, [cancelAnimation]);

  stepRef.current = (timestamp: number) => {
    if (!isHoldingRef.current || holdStartTimeRef.current === null) {
      return;
    }

    const elapsedMs = timestamp - holdStartTimeRef.current;
    const nextProgress = Math.min(elapsedMs / holdDurationMs, 1);
    setProgress(nextProgress);

    if (elapsedMs >= holdDurationMs) {
      cancelAnimation();
      isHoldingRef.current = false;

      if (!isCompletedRef.current) {
        isCompletedRef.current = true;
        onComplete();
      }

      return;
    }

    animationFrameRef.current = window.requestAnimationFrame((nextTimestamp) => {
      stepRef.current?.(nextTimestamp);
    });
  };

  const startHold = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (isDisabled) {
        return;
      }

      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      cancelAnimation();
      holdStartTimeRef.current = performance.now();
      isHoldingRef.current = true;
      isCompletedRef.current = false;
      setProgress(0);
      animationFrameRef.current = window.requestAnimationFrame((timestamp) => {
        stepRef.current?.(timestamp);
      });
    },
    [cancelAnimation, isDisabled],
  );

  const stopHold = useCallback(() => {
    resetHold();
  }, [resetHold]);

  useEffect(() => {
    return () => {
      cancelAnimation();
    };
  }, [cancelAnimation]);

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={isDisabled}
      onPointerDown={startHold}
      onPointerUp={stopHold}
      onPointerLeave={stopHold}
      onPointerCancel={stopHold}
      onContextMenu={(event) => event.preventDefault()}
      className={[
        "relative flex w-full select-none items-center overflow-hidden rounded-xl px-3 py-2 text-left transition-colors touch-manipulation",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ WebkitTouchCallout: "none" }}
    >
      <span
        aria-hidden="true"
        className={[
          "pointer-events-none absolute inset-y-0 left-0 w-full origin-left bg-[#f8626c]/14",
          progressClassName,
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ transform: `scaleX(${progress})` }}
      />
      <span className="relative z-10 flex min-w-0 items-center gap-2">
        {children}
      </span>
    </button>
  );
};

export default HoldToConfirmButton;
