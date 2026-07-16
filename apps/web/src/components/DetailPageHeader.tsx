import React, { useEffect, useState } from "react";
import TabBackButton from "@/components/TabBackButton";
import { type TabKey, useTabNavigation } from "@/context/TabNavigationContext";

interface DetailPageHeaderProps {
  title: string;
  tabKey?: TabKey;
}

const DetailPageHeader: React.FC<DetailPageHeaderProps> = ({
  title,
  tabKey,
}) => {
  const { depthStacks, selectedTab } = useTabNavigation();
  const targetTabKey = tabKey ?? selectedTab;
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const container = document.querySelector(".app-scroll-area");
    if (!container) return;

    const onScroll = () => setIsScrolled(container.scrollTop > 1);
    onScroll();

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  if (depthStacks[targetTabKey].length === 0) {
    return null;
  }

  return (
    <div className="sticky top-0 z-10">
      <div
        className={`flex h-12 items-center justify-center border-b bg-pkpk-bg px-3 transition-colors ${
          isScrolled ? "border-border" : "border-transparent"
        }`}
      >
        <TabBackButton
          tabKey={targetTabKey}
          className="absolute left-0 !bg-transparent !text-pkpk-secondary-bg shadow-none hover:!bg-transparent"
        />
        <h2 className="text-2xl font-bold text-pkpk-secondary-bg">{title}</h2>
      </div>
    </div>
  );
};

export default DetailPageHeader;
