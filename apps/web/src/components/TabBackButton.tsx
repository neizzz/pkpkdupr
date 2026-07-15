import React from "react";
import { Button } from "@heroui/react";
import { IoChevronBack } from "react-icons/io5";
import { type TabKey, useTabNavigation } from "@/context/TabNavigationContext";

interface TabBackButtonProps {
  tabKey?: TabKey;
  label?: string;
  className?: string;
}

const TabBackButton: React.FC<TabBackButtonProps> = ({
  tabKey,
  label = "뒤로가기",
  className,
}) => {
  const { depthStacks, requestCloseTopDepth, selectedTab } = useTabNavigation();
  const targetTabKey = tabKey ?? selectedTab;

  if (depthStacks[targetTabKey].length === 0) {
    return null;
  }

  return (
    <Button
      type="button"
      isIconOnly
      aria-label={label}
      variant="secondary"
      className={["size-9 rounded-full text-pkpk-sub-font", className]
        .filter(Boolean)
        .join(" ")}
      onPress={() => requestCloseTopDepth(targetTabKey)}
    >
      <IoChevronBack className="size-5" />
    </Button>
  );
};

export default TabBackButton;
