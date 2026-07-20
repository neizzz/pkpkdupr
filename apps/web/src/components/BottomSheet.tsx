import React from "react";
import { createPortal } from "react-dom";

const TRANSITION_DURATION_MS = 200;

interface BottomSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  ariaLabel: string;
  children: React.ReactElement | React.ReactElement[];
  className?: string;
  isDismissable?: boolean;
  isActive?: boolean;
}

const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onOpenChange,
  ariaLabel,
  children,
  className,
  isDismissable = true,
  isActive = true,
}) => {
  const [shouldRender, setShouldRender] = React.useState(isOpen);
  const [isVisible, setIsVisible] = React.useState(isOpen);
  const [isSheetTransitionEnabled, setIsSheetTransitionEnabled] =
    React.useState(false);
  const openAnimationFrameRef = React.useRef<number | null>(null);
  const transitionTimeoutRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    if (openAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(openAnimationFrameRef.current);
      openAnimationFrameRef.current = null;
    }

    if (transitionTimeoutRef.current !== null) {
      window.clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }

    if (isOpen) {
      setShouldRender(true);
      setIsSheetTransitionEnabled(true);
      setIsVisible(false);

      openAnimationFrameRef.current = window.requestAnimationFrame(() => {
        setIsVisible(true);
        openAnimationFrameRef.current = null;

        transitionTimeoutRef.current = window.setTimeout(() => {
          setIsSheetTransitionEnabled(false);
          transitionTimeoutRef.current = null;
        }, TRANSITION_DURATION_MS);
      });

      return undefined;
    }

    setIsSheetTransitionEnabled(true);
    setIsVisible(true);
    openAnimationFrameRef.current = window.requestAnimationFrame(() => {
      setIsVisible(false);
      openAnimationFrameRef.current = null;

      transitionTimeoutRef.current = window.setTimeout(() => {
        setShouldRender(false);
        setIsSheetTransitionEnabled(false);
        transitionTimeoutRef.current = null;
      }, TRANSITION_DURATION_MS);
    });

    return undefined;
  }, [isOpen]);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    return () => {
      if (openAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(openAnimationFrameRef.current);
      }

      if (transitionTimeoutRef.current !== null) {
        window.clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  if (!shouldRender) {
    return null;
  }

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      aria-hidden={!isActive}
      className={`fixed inset-0 z-50 flex items-end justify-center ${
        isActive ? "" : "pointer-events-none invisible"
      }`}
      onMouseDown={(event) => {
        if (isDismissable && event.target === event.currentTarget) {
          onOpenChange(false);
        }
      }}
    >
      <div
        aria-hidden="true"
        className={[
          "pointer-events-none absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity duration-200 ease-out",
          isVisible ? "opacity-100" : "opacity-0",
        ].join(" ")}
      />
      <div
        className={[
          "app-shell-width relative z-10 mx-auto w-full",
          isSheetTransitionEnabled
            ? [
                "transform-gpu transition-transform will-change-transform",
                isVisible
                  ? "translate-y-0 duration-200 ease-out"
                  : "translate-y-[calc(100%+2rem)] duration-200 ease-in",
              ].join(" ")
            : "",
        ].join(" ")}
      >
        <div className="pointer-events-none absolute inset-x-0 -top-10 z-20 flex justify-end px-4">
          <button
            type="button"
            aria-label="Close"
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={() => onOpenChange(false)}
            className="pointer-events-auto flex size-6 items-center justify-center text-2xl leading-none text-white transition-opacity opacity-60 hover:opacity-50"
          >
            ×
          </button>
        </div>
        <section
          role="dialog"
          aria-label={ariaLabel}
          className={[
            "app-bottom-sheet-surface relative w-full rounded-t-3xl bg-white pb-[calc(1rem+var(--safe-bottom)+var(--app-keyboard-offset))] shadow-2xl",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {children}
        </section>
      </div>
    </div>,
    document.body,
  );
};

export default BottomSheet;
