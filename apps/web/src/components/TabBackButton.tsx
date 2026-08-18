import React from "react";
import { Button } from "@heroui/react";
import { IoChevronBack } from "react-icons/io5";
import { type TabKey, useTabNavigation } from "@/context/TabNavigationContext";

interface TabBackButtonProps {
  tabKey?: TabKey;
  label?: string;
  className?: string;
  onPress?: () => void;
  children?: React.ReactNode;
}

const TabBackButton: React.FC<TabBackButtonProps> = ({
  tabKey,
  label = "뒤로가기",
  className,
  onPress,
  children,
}) => {
  const { depthStacks, requestCloseTopDepth, selectedTab } = useTabNavigation();
  const targetTabKey = tabKey ?? selectedTab;

  if (!onPress && depthStacks[targetTabKey].length === 0) {
    return null;
  }

  return (
    <Button
      type="button"
      isIconOnly={!children}
      aria-label={label}
      variant="secondary"
      className={[
        children
          ? "h-9 min-w-0 max-w-full rounded-full p-0"
          : "size-9 rounded-full",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onPress={onPress ?? (() => requestCloseTopDepth(targetTabKey))}
    >
      <span className="flex size-9 shrink-0 items-center justify-center">
        <IoChevronBack className="size-5 back-button-icon" />
      </span>
      {children ? <span className="min-w-0 pr-3">{children}</span> : null}
    </Button>
  );
};

export default TabBackButton;
