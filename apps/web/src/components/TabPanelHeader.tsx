import React from "react";

interface TabPanelHeaderProps {
  title: string;
  children?: React.ReactNode;
}

const TabPanelHeader: React.FC<TabPanelHeaderProps> = ({ title, children }) => (
  <div className="sticky top-0 z-10 flex h-12 items-center justify-between bg-pkpk-secondary-bg px-4">
    <h2 className="text-2xl font-bold text-pkpk-secondary-font">{title}</h2>
    {children}
  </div>
);

export default TabPanelHeader;
