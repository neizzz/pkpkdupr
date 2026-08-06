import React, { useEffect, useState } from "react";
import TabBackButton from "@/components/TabBackButton";
import { useRightDrawerScrollContainer } from "@/components/RightDrawer";
import { type TabKey, useTabNavigation } from "@/context/TabNavigationContext";

interface DetailPageHeaderProps {
  title: string;
  tabKey?: TabKey;
  backgroundClassName?: string;
  rightContent?: React.ReactNode;
}

const DetailPageHeader: React.FC<DetailPageHeaderProps> = ({
  title,
  tabKey,
  backgroundClassName = "bg-pkpk-bg",
  rightContent,
}) => {
  const { depthStacks, selectedTab } = useTabNavigation();
  const targetTabKey = tabKey ?? selectedTab;
  const [isScrolled, setIsScrolled] = useState(false);
  const rightDrawerScrollContainer = useRightDrawerScrollContainer();
  const isRightDrawerPage = rightDrawerScrollContainer !== null;
  const headerBackgroundClassName = isRightDrawerPage
    ? "bg-transparent"
    : backgroundClassName;
  const scrolledButtonClassName =
    "!bg-[#EBEEFA]/90 shadow-none hover:!bg-[#EBEEFA]";
  const backButtonClassName = `absolute left-3 !text-pkpk-secondary-bg shadow-none transition-colors duration-100 ${
    isScrolled
      ? scrolledButtonClassName
      : "!bg-transparent !text-pkpk-secondary-bg hover:!bg-transparent"
  }`;
  const rightContentClassName = `absolute right-3 flex items-center [&_button]:!px-3 [&_button]:transition-colors [&_button]:duration-100 ${
    isScrolled
      ? "[&_button]:!bg-[#EBEEFA]/90 [&_button]:shadow-none [&_button:hover]:!bg-[#EBEEFA]"
      : ""
  }`;

  useEffect(() => {
    const container =
      rightDrawerScrollContainer ??
      document.querySelector<HTMLDivElement>(".app-tab-panel-scroll-area");
    if (!container) return;

    const onScroll = () => setIsScrolled(container.scrollTop >= 5);
    onScroll();

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [rightDrawerScrollContainer]);

  if (
    depthStacks[targetTabKey].length === 0 &&
    !rightDrawerScrollContainer
  ) {
    return null;
  }

  return (
    <div className={`sticky top-0 z-20 ${headerBackgroundClassName}`}>
      <div
        className={`flex h-12 items-center justify-center ${headerBackgroundClassName} px-3 transition-colors ${
          !isRightDrawerPage
            ? `border-b ${isScrolled ? "border-border" : "border-transparent"}`
            : ""
        }`}
      >
        <TabBackButton tabKey={targetTabKey} className={backButtonClassName} />
        {!isRightDrawerPage ? (
          <h2 className="text-2xl font-bold text-pkpk-secondary-bg">{title}</h2>
        ) : null}
        {rightContent ? (
          <div className={rightContentClassName}>{rightContent}</div>
        ) : null}
      </div>
    </div>
  );
};

export default DetailPageHeader;
