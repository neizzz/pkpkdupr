import React, { useEffect, useState } from "react";

interface TabPanelHeaderProps {
  title: string;
  children?: React.ReactNode;
}

const TabPanelHeader: React.FC<TabPanelHeaderProps> = ({ title, children }) => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const container = document.querySelector(".app-tab-panel-scroll-area");
    if (!container) return;

    const onScroll = () => setIsScrolled(container.scrollTop > 1);
    onScroll();

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="sticky top-0 z-10">
      <div
        className={`flex h-12 items-center justify-between border-b bg-pkpk-bg px-4 transition-colors ${
          isScrolled ? "border-border" : "border-transparent"
        }`}
      >
        <h2 className="text-[28.8px] font-bold text-pkpk-secondary-bg">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
};

export default TabPanelHeader;
