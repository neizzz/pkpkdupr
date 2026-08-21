import React from "react";
import { createPortal } from "react-dom";
import { DIMMED_THEME_COLOR } from "@/lib/themeColor";

const TRANSITION_DURATION_MS = 84;

interface BottomSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  ariaLabel: string;
  children: React.ReactElement | React.ReactElement[];
  className?: string;
  isDismissable?: boolean;
  isActive?: boolean;
  layer?: number;
}

interface BottomSheetBodyProps {
  children: React.ReactNode;
  className?: string;
}

interface BottomSheetHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface BottomSheetActionsProps {
  children: React.ReactNode;
  className?: string;
}

const BottomSheetHeader: React.FC<BottomSheetHeaderProps> = ({
  children,
  className,
}) => (
  <div
    className={["relative z-10 shrink-0 bg-white pb-4", className]
      .filter(Boolean)
      .join(" ")}
  >
    {children}
  </div>
);

const BottomSheetBody: React.FC<BottomSheetBodyProps> = ({
  children,
  className,
}) => (
  <div
    className={[
      "app-bottom-sheet-body min-h-0 flex-1 flex flex-col gap-4",
      className,
    ]
      .filter(Boolean)
      .join(" ")}
  >
    {children}
  </div>
);

const BottomSheetActions: React.FC<BottomSheetActionsProps> = ({
  children,
  className,
}) => {
  const actionCount = React.Children.count(children);
  const layoutClassName =
    actionCount === 2
      ? "grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
      : "grid-cols-1";

  return (
    <div
      className={["grid w-full gap-2 [&>*]:w-full", layoutClassName, className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
};

type BottomSheetComponent = React.FC<BottomSheetProps> & {
  Header: typeof BottomSheetHeader;
  Body: typeof BottomSheetBody;
  Actions: typeof BottomSheetActions;
};

const BottomSheet: BottomSheetComponent = ({
  isOpen,
  onOpenChange,
  ariaLabel,
  children,
  className,
  isDismissable = true,
  isActive = true,
  layer = 50,
}) => {
  const [shouldRender, setShouldRender] = React.useState(isOpen);
  const [isVisible, setIsVisible] = React.useState(isOpen);
  const [isSheetTransitionEnabled, setIsSheetTransitionEnabled] =
    React.useState(false);
  const openAnimationFrameRef = React.useRef<number | null>(null);
  const transitionTimeoutRef = React.useRef<number | null>(null);
  const transitionStyle = React.useMemo(
    () => ({ transitionDuration: `${TRANSITION_DURATION_MS}ms` }),
    [],
  );

  React.useLayoutEffect(() => {
    if (!shouldRender || !isActive || typeof document === "undefined") {
      return undefined;
    }

    const themeColorMeta = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );

    if (!themeColorMeta) {
      return undefined;
    }

    const previousThemeColor = themeColorMeta.getAttribute("content");
    themeColorMeta.setAttribute("content", DIMMED_THEME_COLOR);

    return () => {
      if (themeColorMeta.getAttribute("content") === DIMMED_THEME_COLOR) {
        themeColorMeta.setAttribute(
          "content",
          previousThemeColor ?? "",
        );
      }
    };
  }, [isActive, shouldRender]);

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
      // Mount the sheet below the viewport first, then start the transition on
      // the following frame. Without this, a newly mounted sheet can paint at
      // its final position before the browser observes the transition.
      setIsSheetTransitionEnabled(false);
      setIsVisible(false);

      openAnimationFrameRef.current = window.requestAnimationFrame(() => {
        openAnimationFrameRef.current = window.requestAnimationFrame(() => {
          setIsSheetTransitionEnabled(true);
          setIsVisible(true);
          openAnimationFrameRef.current = null;

          transitionTimeoutRef.current = window.setTimeout(() => {
            setIsSheetTransitionEnabled(false);
            transitionTimeoutRef.current = null;
          }, TRANSITION_DURATION_MS);
        });
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
      className={`fixed inset-0 flex items-end justify-center ${
        isActive ? "" : "pointer-events-none invisible"
      }`}
      style={{ zIndex: layer }}
      onMouseDown={(event) => {
        if (isDismissable && event.target === event.currentTarget) {
          onOpenChange(false);
        }
      }}
    >
      <div
        aria-hidden="true"
        className={[
          "pointer-events-none absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity ease-out",
          isVisible ? "opacity-100" : "opacity-0",
        ].join(" ")}
        style={transitionStyle}
      />
      <div
        className={[
          "app-shell-width relative z-10 mx-auto w-full",
          isSheetTransitionEnabled
            ? [
                "transform-gpu transition-transform will-change-transform",
                isVisible
                  ? "translate-y-0 ease-out"
                  : "translate-y-[calc(100%+2rem)] ease-in",
              ].join(" ")
            : [
                "transform-gpu",
                isVisible ? "translate-y-0" : "translate-y-[calc(100%+2rem)]",
              ].join(" "),
        ].join(" ")}
        style={transitionStyle}
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
            style={transitionStyle}
          >
            ×
          </button>
        </div>
        <section
          role="dialog"
          aria-label={ariaLabel}
          className={[
            "app-bottom-sheet-surface relative flex min-h-0 w-full flex-col overflow-hidden rounded-t-3xl bg-white px-4 pt-5 pb-[calc(1rem+var(--safe-bottom)+var(--app-keyboard-offset))] shadow-2xl",
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

BottomSheet.Header = BottomSheetHeader;
BottomSheet.Body = BottomSheetBody;
BottomSheet.Actions = BottomSheetActions;

export default BottomSheet;
