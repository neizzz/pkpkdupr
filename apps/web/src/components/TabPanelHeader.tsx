import React, { useCallback, useLayoutEffect, useRef, useState } from "react";

interface TabPanelHeaderProps {
  title: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  showGradientExtension?: boolean;
  onHeaderElementChange?: (element: HTMLDivElement | null) => void;
}

interface TabPanelHeaderGradientExtensionProps {
  headerElement: HTMLDivElement | null;
  className?: string;
  position?: "sticky" | "flow";
}

const getGradientExtensionHeight = (headerWidth: number) =>
  Math.min(64, Math.max(48, headerWidth / 7.5));

export const TabPanelHeaderGradientExtension: React.FC<
  TabPanelHeaderGradientExtensionProps
> = ({ headerElement, className = "z-30", position = "sticky" }) => {
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

      if (position === "sticky") {
        gradientExtensionAnchor.style.top = `${headerHeight}px`;
      } else {
        gradientExtensionAnchor.style.removeProperty("top");
      }
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
        position === "sticky" && container.scrollTop > 1 ? "0" : "1",
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
  }, [headerElement, position]);

  if (!headerElement) return null;

  return (
    <div
      aria-hidden="true"
      ref={gradientExtensionAnchorRef}
      className={`tab-panel-header-gradient-extension-anchor ${
        position === "sticky" ? "sticky top-12" : "relative"
      } ${className} h-0`}
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
  footer,
  showGradientExtension = true,
  onHeaderElementChange,
}) => {
  const [headerElement, setHeaderElement] = useState<HTMLDivElement | null>(
    null,
  );
  const gradientBaseRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const handleHeaderElementChange = useCallback(
    (element: HTMLDivElement | null) => {
      setHeaderElement(element);
      onHeaderElementChange?.(element);
    },
    [onHeaderElementChange],
  );

  useLayoutEffect(() => {
    const gradientBase = gradientBaseRef.current;
    if (!headerElement || !gradientBase) return;

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
    updateGradient();

    return () => {
      resizeObserver.disconnect();
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
        <div className="relative z-10">
          <div className="flex min-h-12 items-center justify-between px-4">
            <h2 className="text-[28.8px] font-bold text-pkpk-primary-font">
              {title}
            </h2>
            {children}
          </div>
          {footer ? <div className="px-4 pb-2">{footer}</div> : null}
        </div>
      </div>
      {showGradientExtension ? (
        <TabPanelHeaderGradientExtension headerElement={headerElement} />
      ) : null}
    </>
  );
};

export default TabPanelHeader;
