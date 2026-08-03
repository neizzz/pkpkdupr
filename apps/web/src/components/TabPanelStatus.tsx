import React from "react";
import { Spinner } from "@heroui/react";
import TabPanelEmptyState, {
  type TabPanelEmptyStateTone,
} from "./TabPanelEmptyState";

interface TabPanelStatusProps {
  message?: string;
  ariaLabel?: string;
  isLoading?: boolean;
  tone?: TabPanelEmptyStateTone;
}

const TabPanelStatus: React.FC<TabPanelStatusProps> = ({
  ariaLabel,
  message,
  isLoading = false,
  tone = "default",
}) => {
  if (!isLoading) {
    return <TabPanelEmptyState message={message} tone={tone} />;
  }

  return (
    <div className="flex min-h-[240px] flex-1 items-center justify-center px-6 py-12 text-center">
      <div className="flex flex-col items-center gap-3">
        <Spinner
          aria-label={ariaLabel ?? message ?? "로딩 중"}
          className="text-[#409eff]"
          color="current"
          size="md"
        />
        {message ? <p className="text-sm font-medium text-pkpk-sub-font">{message}</p> : null}
      </div>
    </div>
  );
};

export default TabPanelStatus;
