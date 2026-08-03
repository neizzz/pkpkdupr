import React, { useCallback, useLayoutEffect, useRef, useState } from "react";

interface TabPanelHeaderProps {
  title: string;
  children?: React.ReactNode;
  showGradientExtension?: boolean;
  onHeaderElementChange?: (element: HTMLDivElement | null) => void;
}

interface TabPanelHeaderGradientExtensionProps {
  headerElement: HTMLDivElement | null;
  className?: string;
}

const getGradientExtensionHeight = (headerWidth: number) =>
  Math.min(64, Math.max(48, headerWidth / 7.5));

export const TabPanelHeaderGradientExtension: React.FC<
  TabPanelHeaderGradientExtensionProps
> = ({ headerElement, className = "z-30" }) => {
  const gradientExtensionAnchorRef = useRef<HTMLDivElement | null>(null);
  const gradientExtensionRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const container = document.querySelector(".app-tab-panel-scroll-area");
    const gradientExtensionAnchor = gradientExtensionAnchorRef.current;
    const gradientExtension = gradientExtensionRef.current;
    if (
      !container ||
      !headerElement ||
      !gradientExtensionAnchor ||
      !gradientExtension
    ) {
      return;
    }

    const updateGradientExtension = () => {
      const headerHeight = headerElement.clientHeight;
      if (!headerHeight) return;

      const extensionHeight = getGradientExtensionHeight(
        headerElement.clientWidth,
      );
      const totalHeight = headerHeight + extensionHeight;

      gradientExtensionAnchor.style.top = `${headerHeight}px`;
      gradientExtension.style.setProperty(
        "--tab-panel-header-gradient-extension-height",
        `${extensionHeight}px`,
      );
      gradientExtension.style.setProperty(
        "--tab-panel-header-gradient-header-height",
        `${headerHeight}px`,
      );
      gradientExtension.style.setProperty(
        "--tab-panel-header-gradient-total-height",
        `${totalHeight}px`,
      );
      gradientExtension.style.setProperty(
        "--tab-panel-header-gradient-extension-scale-y",
        container.scrollTop > 1 ? "0" : "1",
      );
    };

    const scheduleGradientUpdate = () => {
      if (animationFrameRef.current !== null) return;

      animationFrameRef.current = window.requestAnimationFrame(() => {
        animationFrameRef.current = null;
        updateGradientExtension();
      });
    };

    const resizeObserver = new ResizeObserver(scheduleGradientUpdate);
    resizeObserver.observe(headerElement);
    container.addEventListener("scroll", scheduleGradientUpdate, {
      passive: true,
    });
    updateGradientExtension();

    return () => {
      resizeObserver.disconnect();
      container.removeEventListener("scroll", scheduleGradientUpdate);
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [headerElement]);

  if (!headerElement) return null;

  return (
    <div
      aria-hidden="true"
      ref={gradientExtensionAnchorRef}
      className={`tab-panel-header-gradient-extension-anchor sticky top-12 ${className} h-0`}
    >
      <div
        ref={gradientExtensionRef}
        className="tab-panel-header-gradient-extension pointer-events-none absolute inset-x-0 top-0 origin-top transition-transform duration-100 will-change-transform"
      />
    </div>
  );
};

const TabPanelHeader: React.FC<TabPanelHeaderProps> = ({
  title,
  children,
  showGradientExtension = true,
  onHeaderElementChange,
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [headerElement, setHeaderElement] = useState<HTMLDivElement | null>(
    null,
  );
  const gradientBaseRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isScrolledRef = useRef(false);

  const handleHeaderElementChange = useCallback(
    (element: HTMLDivElement | null) => {
      setHeaderElement(element);
      onHeaderElementChange?.(element);
    },
    [onHeaderElementChange],
  );

  useLayoutEffect(() => {
    const container = document.querySelector(".app-tab-panel-scroll-area");
    const gradientBase = gradientBaseRef.current;
    if (!container || !headerElement || !gradientBase) return;

    const updateGradient = () => {
      const headerHeight = headerElement.clientHeight;
      if (!headerHeight) return;

      const totalHeight =
        headerHeight + getGradientExtensionHeight(headerElement.clientWidth);
      gradientBase.style.setProperty(
        "--tab-panel-header-gradient-header-height",
        `${headerHeight}px`,
      );
      gradientBase.style.setProperty(
        "--tab-panel-header-gradient-total-height",
        `${totalHeight}px`,
      );

      const nextIsScrolled = container.scrollTop > 1;
      if (isScrolledRef.current !== nextIsScrolled) {
        isScrolledRef.current = nextIsScrolled;
        setIsScrolled(nextIsScrolled);
      }
    };

    const scheduleGradientUpdate = () => {
      if (animationFrameRef.current !== null) return;

      animationFrameRef.current = window.requestAnimationFrame(() => {
        animationFrameRef.current = null;
        updateGradient();
      });
    };

    const resizeObserver = new ResizeObserver(scheduleGradientUpdate);
    resizeObserver.observe(headerElement);
    container.addEventListener("scroll", scheduleGradientUpdate, {
      passive: true,
    });
    updateGradient();

    return () => {
      resizeObserver.disconnect();
      container.removeEventListener("scroll", scheduleGradientUpdate);
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [headerElement]);

  return (
    <>
      <div ref={handleHeaderElementChange} className="sticky top-0 z-20 isolate">
        <div
          ref={gradientBaseRef}
          aria-hidden="true"
          className="tab-panel-header-gradient-base pointer-events-none absolute inset-x-0 top-0 h-full"
        />
        <div
          className={`relative z-10 flex min-h-12 items-center justify-between border-b px-4 transition-colors ${
            isScrolled ? "border-white/20" : "border-transparent"
          }`}
        >
          <h2 className="text-[28.8px] font-bold text-pkpk-primary-font">
            {title}
          </h2>
          {children}
        </div>
      </div>
      {showGradientExtension ? (
        <TabPanelHeaderGradientExtension headerElement={headerElement} />
      ) : null}
    </>
  );
};

export default TabPanelHeader;
