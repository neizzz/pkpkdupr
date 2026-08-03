import React from "react";

export type TabPanelEmptyStateTone = "default" | "error";

interface TabPanelEmptyStateProps {
  message?: string;
  tone?: TabPanelEmptyStateTone;
  children?: React.ReactNode;
}

const TabPanelEmptyState: React.FC<TabPanelEmptyStateProps> = ({
  message,
  tone = "default",
  children,
}) => (
  <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-12 text-center">
    <div className="flex w-full flex-col items-center gap-3">
      {message ? (
        <p
          className={`text-sm font-medium ${
            tone === "error" ? "text-error" : "text-pkpk-sub-font"
          }`}
        >
          {message}
        </p>
      ) : null}
      {children}
    </div>
  </div>
);

export default TabPanelEmptyState;
