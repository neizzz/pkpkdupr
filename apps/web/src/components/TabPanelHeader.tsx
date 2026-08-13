import React, { useCallback, useLayoutEffect, useRef } from "react";

interface TabPanelHeaderProps {
  title: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
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
    const container = document.querySelector<HTMLDivElement>(
      ".app-tab-panel-scroll-area",
    );
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
      const { height: headerHeight, width: headerWidth } =
        headerElement.getBoundingClientRect();
      if (!headerHeight) return;

      const extensionHeight = getGradientExtensionHeight(headerWidth);
      const totalHeight = headerHeight + extensionHeight;
      const isExtensionVisible = container.scrollTop <= 1;

      headerElement.style.setProperty(
        "--tab-panel-header-gradient-header-height",
        `${headerHeight}px`,
      );
      headerElement.style.setProperty(
        "--tab-panel-header-gradient-total-height",
        `${totalHeight}px`,
      );
      gradientExtensionAnchor.style.top = `${headerHeight}px`;
      gradientExtension.style.setProperty(
        "--tab-panel-header-gradient-header-height",
        `${headerHeight}px`,
      );
      gradientExtension.style.setProperty(
        "--tab-panel-header-gradient-total-height",
        `${totalHeight}px`,
      );
      gradientExtension.style.setProperty(
        "--tab-panel-header-gradient-visible-height",
        `${headerHeight + (isExtensionVisible ? extensionHeight : 0)}px`,
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

  return (
    <div
      aria-hidden="true"
      ref={gradientExtensionAnchorRef}
      className={`tab-panel-header-gradient-extension-anchor sticky top-12 ${className} h-0`}
    >
      <div
        ref={gradientExtensionRef}
        className="tab-panel-header-gradient-extension pointer-events-none absolute inset-x-0"
      />
    </div>
  );
};

const TabPanelHeader: React.FC<TabPanelHeaderProps> = ({
  title,
  children,
  footer,
  onHeaderElementChange,
}) => {
  const handleHeaderElementChange = useCallback(
    (element: HTMLDivElement | null) => {
      onHeaderElementChange?.(element);
    },
    [onHeaderElementChange],
  );

  return (
    <div
      ref={handleHeaderElementChange}
      className="tab-panel-header-gradient-base sticky top-0 z-20 isolate"
    >
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
  );
};

export default TabPanelHeader;
