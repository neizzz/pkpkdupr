import React from "react";
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

  if (depthStacks[targetTabKey].length === 0) {
    return null;
  }

  return (
    <div className="sticky top-0 z-10 flex h-12 items-center justify-center bg-pkpk-secondary-bg px-3">
      <TabBackButton
        tabKey={targetTabKey}
        className="absolute left-0 !bg-transparent !text-pkpk-secondary-font shadow-none hover:!bg-transparent"
      />
      <h2 className="text-xl font-bold text-pkpk-secondary-font">{title}</h2>
    </div>
  );
};

export default DetailPageHeader;
