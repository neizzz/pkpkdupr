import React from "react";
import TabBackButton from "@/components/TabBackButton";
import {
  type TabKey,
  useTabNavigation,
} from "@/context/TabNavigationContext";

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
    <div className="relative flex min-h-9 items-center justify-center">
      <TabBackButton
        tabKey={targetTabKey}
        className="absolute left-0 !bg-transparent shadow-none hover:!bg-transparent"
      />
      <h2 className="text-lg font-bold text-amber-950">{title}</h2>
    </div>
  );
};

export default DetailPageHeader;
