import React, { createContext, useContext } from "react";

export type TabKey = "match" | "members" | "me";

export type TabDepthKind =
  | "match-detail"
  | "member-profile"
  | "bottom-sheet"
  | "dropdown";

export interface TabDepthEntry {
  id: string;
  kind: TabDepthKind;
  onClose: () => void;
}

export type TabDepthStacks = Record<TabKey, string[]>;

export interface TabNavigationContextValue {
  selectedTab: TabKey;
  depthStacks: TabDepthStacks;
  pushDepth: (tabKey: TabKey, entry: TabDepthEntry) => () => void;
  closeDepth: (
    tabKey: TabKey,
    depthId: string,
    afterClose?: () => void,
  ) => boolean;
  requestCloseTopDepth: (tabKey?: TabKey) => boolean;
  saveScrollPosition: (tabKey?: TabKey) => void;
  restoreScrollTop: (tabKey?: TabKey) => void;
  scrollToTop: (behavior?: ScrollBehavior) => void;
  getScrollTop: () => number;
}

const TabNavigationContext = createContext<TabNavigationContextValue | null>(
  null,
);

export const TabNavigationProvider: React.FC<{
  value: TabNavigationContextValue;
  children: React.ReactNode;
}> = ({ value, children }) => (
  <TabNavigationContext.Provider value={value}>
    {children}
  </TabNavigationContext.Provider>
);

export const useTabNavigation = (): TabNavigationContextValue => {
  const context = useContext(TabNavigationContext);

  if (!context) {
    throw new Error("useTabNavigation must be used within TabNavigationProvider");
  }

  return context;
};
