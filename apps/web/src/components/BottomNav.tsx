import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button, Dropdown, Label, Separator, Tabs } from "@heroui/react";
import {
  IoAdd,
  IoAddCircleOutline,
  IoLogOutOutline,
  IoPeopleOutline,
  IoPersonCircleOutline,
  IoQrCodeSharp,
  IoTennisballOutline,
} from "react-icons/io5";
import type { PlayerQrTokenResponse } from "@pkpkdupr/shared/qr";
import BottomSheet from "@/components/BottomSheet";
import CreateMatchDrawerBody from "@/components/CreateMatchDrawerBody";
import HoldToConfirmButton from "@/components/HoldToConfirmButton";
import PlayerQrSheetBody from "@/components/PlayerQrSheetBody";
import { useAuth } from "@/context/AuthContext";
import {
  TabNavigationProvider,
  type TabDepthEntry,
  type TabDepthStacks,
  type TabKey,
} from "@/context/TabNavigationContext";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { buildApiUrl } from "@/lib/api";
import Matches from "@/pages/Matches";
import Members from "@/pages/Members";
import Me from "@/pages/Me";

const TAB_KEYS: TabKey[] = ["match", "members", "me"];
const DEFAULT_THEME_COLOR = "#ffffff";
const TAB_THEME_COLOR_MAP: Record<TabKey, string> = {
  match: "#f9fafb",
  members: "#f9fafb",
  me: DEFAULT_THEME_COLOR,
};

const emptyDepthStacks = (): TabDepthStacks => ({
  match: [],
  members: [],
  me: [],
});

const emptyScrollPositions = (): Record<TabKey, number> => ({
  match: 0,
  members: 0,
  me: 0,
});

const HISTORY_DEPTH_STATE_KEY = "__pkpkduprTabDepth";

interface TabDepthHistoryState {
  [HISTORY_DEPTH_STATE_KEY]: true;
  tabKey: TabKey;
  depthId: string;
  sequence: number;
}

const isTabDepthHistoryState = (
  state: unknown,
): state is TabDepthHistoryState => {
  if (!state || typeof state !== "object") return false;

  const maybeState = state as Partial<TabDepthHistoryState>;
  return (
    maybeState[HISTORY_DEPTH_STATE_KEY] === true &&
    typeof maybeState.depthId === "string" &&
    TAB_KEYS.includes(maybeState.tabKey as TabKey)
  );
};

const BottomNav: React.FC = () => {
  const { token, logout } = useAuth();
  const isOnline = useOnlineStatus();
  const [selectedTab, setSelectedTab] = useState<TabKey>("me");
  const [depthStacks, setDepthStacks] =
    useState<TabDepthStacks>(emptyDepthStacks);
  const [isGlobalMenuOpen, setIsGlobalMenuOpen] = useState(false);
  const [globalMenuTabKey, setGlobalMenuTabKey] = useState<TabKey>("me");
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [qrTabKey, setQrTabKey] = useState<TabKey>("me");
  const [isCreateMatchOpen, setIsCreateMatchOpen] = useState(false);
  const [createMatchTabKey, setCreateMatchTabKey] = useState<TabKey>("me");
  const [matchesReloadKey, setMatchesReloadKey] = useState(0);
  const isCreateMatchQrScannerOpenRef = useRef(false);
  const [qrToken, setQrToken] = useState<PlayerQrTokenResponse | null>(null);
  const [isQrLoading, setIsQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrRemainingSeconds, setQrRemainingSeconds] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const selectedTabRef = useRef<TabKey>(selectedTab);
  const depthEntriesRef = useRef<Record<TabKey, TabDepthEntry[]>>({
    match: [],
    members: [],
    me: [],
  });
  const scrollPositionsRef = useRef<Record<TabKey, number>>(
    emptyScrollPositions(),
  );
  const historySequenceRef = useRef(0);
  const afterCloseCallbacksRef = useRef(new Map<string, () => void>());
  const closingDepthKeysRef = useRef(new Set<string>());

  const depthCallbackKey = (tabKey: TabKey, depthId: string) =>
    `${tabKey}:${depthId}`;

  const syncDepthStacks = useCallback(() => {
    setDepthStacks({
      match: depthEntriesRef.current.match.map((entry) => entry.id),
      members: depthEntriesRef.current.members.map((entry) => entry.id),
      me: depthEntriesRef.current.me.map((entry) => entry.id),
    });
  }, []);

  const getScrollTop = useCallback(
    () => scrollContainerRef.current?.scrollTop ?? 0,
    [],
  );

  const saveScrollPosition = useCallback(
    (tabKey = selectedTabRef.current) => {
      scrollPositionsRef.current[tabKey] = getScrollTop();
    },
    [getScrollTop],
  );

  const restoreScrollTop = useCallback((tabKey = selectedTabRef.current) => {
    window.requestAnimationFrame(() => {
      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer) return;

      scrollContainer.scrollTop = scrollPositionsRef.current[tabKey] ?? 0;
    });
  }, []);

  const scrollToTop = useCallback((behavior: ScrollBehavior = "smooth") => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior });
  }, []);

  const removeDepthEntry = useCallback(
    (tabKey: TabKey, depthId: string) => {
      const stack = depthEntriesRef.current[tabKey];
      const targetEntry = stack.find((entry) => entry.id === depthId);

      if (!targetEntry) return false;

      depthEntriesRef.current = {
        ...depthEntriesRef.current,
        [tabKey]: stack.filter((entry) => entry.id !== depthId),
      };
      syncDepthStacks();
      targetEntry.onClose();

      const callbackKey = depthCallbackKey(tabKey, depthId);
      closingDepthKeysRef.current.delete(callbackKey);
      const afterClose = afterCloseCallbacksRef.current.get(callbackKey);
      if (afterClose) {
        afterCloseCallbacksRef.current.delete(callbackKey);
        afterClose();
      }

      return true;
    },
    [syncDepthStacks],
  );

  const isCurrentHistoryDepth = useCallback(
    (tabKey: TabKey, depthId: string) => {
      const historyState = window.history.state;

      return (
        isTabDepthHistoryState(historyState) &&
        historyState.tabKey === tabKey &&
        historyState.depthId === depthId
      );
    },
    [],
  );

  const pushDepth = useCallback(
    (tabKey: TabKey, entry: TabDepthEntry) => {
      const stack = depthEntriesRef.current[tabKey];
      const existingEntry = stack.find(
        (stackEntry) => stackEntry.id === entry.id,
      );

      if (!existingEntry) {
        depthEntriesRef.current = {
          ...depthEntriesRef.current,
          [tabKey]: [...stack, entry],
        };
        syncDepthStacks();
        historySequenceRef.current += 1;
        window.history.pushState(
          {
            [HISTORY_DEPTH_STATE_KEY]: true,
            tabKey,
            depthId: entry.id,
            sequence: historySequenceRef.current,
          } satisfies TabDepthHistoryState,
          "",
          window.location.href,
        );
      }

      return () => {
        const currentStack = depthEntriesRef.current[tabKey];
        if (!currentStack.some((stackEntry) => stackEntry.id === entry.id)) {
          return;
        }

        depthEntriesRef.current = {
          ...depthEntriesRef.current,
          [tabKey]: currentStack.filter(
            (stackEntry) => stackEntry.id !== entry.id,
          ),
        };
        syncDepthStacks();
      };
    },
    [syncDepthStacks],
  );

  const closeDepth = useCallback(
    (tabKey: TabKey, depthId: string, afterClose?: () => void) => {
      const stack = depthEntriesRef.current[tabKey];
      if (!stack.some((entry) => entry.id === depthId)) return false;

      if (afterClose) {
        afterCloseCallbacksRef.current.set(
          depthCallbackKey(tabKey, depthId),
          afterClose,
        );
      }

      const callbackKey = depthCallbackKey(tabKey, depthId);
      if (isCurrentHistoryDepth(tabKey, depthId)) {
        if (!closingDepthKeysRef.current.has(callbackKey)) {
          closingDepthKeysRef.current.add(callbackKey);
          window.history.back();
        }
        return true;
      }

      return removeDepthEntry(tabKey, depthId);
    },
    [isCurrentHistoryDepth, removeDepthEntry],
  );

  const requestCloseTopDepth = useCallback(
    (tabKey = selectedTabRef.current) => {
      const stack = depthEntriesRef.current[tabKey];
      const topEntry = stack[stack.length - 1];
      if (!topEntry) return false;

      return closeDepth(tabKey, topEntry.id);
    },
    [closeDepth],
  );

  const selectTab = useCallback(
    (nextTab: TabKey) => {
      const currentTab = selectedTabRef.current;
      if (nextTab === currentTab) return;

      saveScrollPosition(currentTab);
      selectedTabRef.current = nextTab;
      setSelectedTab(nextTab);
      restoreScrollTop(nextTab);
    },
    [restoreScrollTop, saveScrollPosition],
  );

  const handleSelectionChange = useCallback(
    (key: React.Key) => {
      selectTab(String(key) as TabKey);
    },
    [selectTab],
  );

  const handleActiveTabClick = useCallback(
    (tabKey: TabKey) => {
      if (selectedTabRef.current !== tabKey) return;

      if (getScrollTop() > 0) {
        scrollToTop("smooth");
        return;
      }

      requestCloseTopDepth(tabKey);
    },
    [getScrollTop, requestCloseTopDepth, scrollToTop],
  );

  const openGlobalMenu = useCallback(() => {
    const tabKey = selectedTabRef.current;
    setGlobalMenuTabKey(tabKey);
    pushDepth(tabKey, {
      id: "global-menu",
      kind: "dropdown",
      onClose: () => setIsGlobalMenuOpen(false),
    });
    setIsGlobalMenuOpen(true);
  }, [pushDepth]);

  const openQrSheet = useCallback(() => {
    const tabKey = selectedTabRef.current;
    setQrTabKey(tabKey);
    pushDepth(tabKey, {
      id: "qr-sheet",
      kind: "bottom-sheet",
      onClose: () => setIsQrOpen(false),
    });
    setIsQrOpen(true);
  }, [pushDepth]);

  const openCreateMatchSheet = useCallback(() => {
    const tabKey = selectedTabRef.current;
    setCreateMatchTabKey(tabKey);
    isCreateMatchQrScannerOpenRef.current = false;
    pushDepth(tabKey, {
      id: "create-match-sheet",
      kind: "bottom-sheet",
      onClose: () => setIsCreateMatchOpen(false),
    });
    setIsCreateMatchOpen(true);
  }, [pushDepth]);

  const handleGlobalMenuOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        openGlobalMenu();
        return;
      }

      if (!closeDepth(globalMenuTabKey, "global-menu")) {
        setIsGlobalMenuOpen(false);
      }
    },
    [closeDepth, globalMenuTabKey, openGlobalMenu],
  );

  const handleQrOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        openQrSheet();
        return;
      }

      if (!closeDepth(qrTabKey, "qr-sheet")) {
        setIsQrOpen(false);
      }
    },
    [closeDepth, openQrSheet, qrTabKey],
  );

  const handleCreateMatchOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        openCreateMatchSheet();
        return;
      }

      if (isCreateMatchQrScannerOpenRef.current) {
        return;
      }

      if (!closeDepth(createMatchTabKey, "create-match-sheet")) {
        setIsCreateMatchOpen(false);
      }
    },
    [closeDepth, createMatchTabKey, openCreateMatchSheet],
  );

  const loadPlayerQrToken = useCallback(async () => {
    if (!isOnline) {
      setQrToken(null);
      setQrError(
        "오프라인에서는 QR 코드를 생성할 수 없습니다. 온라인 연결이 필요합니다.",
      );
      setQrRemainingSeconds(0);
      return;
    }

    if (!token) {
      setQrToken(null);
      setQrError("로그인이 필요합니다.");
      setQrRemainingSeconds(0);
      return;
    }

    try {
      setIsQrLoading(true);
      setQrError(null);

      const res = await fetch(buildApiUrl("/api/player-qr-token"), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "QR 코드를 생성하지 못했습니다.");
      }

      const data = (await res.json()) as PlayerQrTokenResponse;
      setQrToken(data);
      setQrRemainingSeconds(data.ttlSeconds);
    } catch (err) {
      setQrError(
        err instanceof Error ? err.message : "QR 코드를 생성하지 못했습니다.",
      );
    } finally {
      setIsQrLoading(false);
    }
  }, [isOnline, token]);

  const handleRefreshPlayerQrToken = useCallback(() => {
    if (qrToken && qrRemainingSeconds > 60) {
      return;
    }

    void loadPlayerQrToken();
  }, [loadPlayerQrToken, qrRemainingSeconds, qrToken]);

  useEffect(() => {
    selectedTabRef.current = selectedTab;
  }, [selectedTab]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const themeColorMeta = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );

    if (!themeColorMeta) {
      return;
    }

    themeColorMeta.setAttribute("content", TAB_THEME_COLOR_MAP[selectedTab]);

    return () => {
      themeColorMeta.setAttribute("content", DEFAULT_THEME_COLOR);
    };
  }, [selectedTab]);

  useEffect(() => {
    const handlePopState = () => {
      const activeTab = selectedTabRef.current;
      const activeStack = depthEntriesRef.current[activeTab];
      const topEntry = activeStack[activeStack.length - 1];

      if (!topEntry) return;

      removeDepthEntry(activeTab, topEntry.id);
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [removeDepthEntry]);

  useEffect(() => {
    if (isQrOpen) {
      void loadPlayerQrToken();
    }
  }, [isQrOpen, loadPlayerQrToken]);

  useEffect(() => {
    if (!isQrOpen || !qrToken) {
      return;
    }

    const updateRemainingTime = () => {
      const expiresAtMs = new Date(qrToken.expiresAt).getTime();
      setQrRemainingSeconds(
        Math.max(0, Math.ceil((expiresAtMs - Date.now()) / 1000)),
      );
    };

    updateRemainingTime();
    const intervalId = window.setInterval(updateRemainingTime, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isQrOpen, qrToken]);

  const handleGlobalAction = (key: React.Key) => {
    const action = () => {
      switch (String(key)) {
        case "qr":
          if (!isOnline) return;
          openQrSheet();
          break;
        case "create-match":
          if (!isOnline) return;
          openCreateMatchSheet();
          break;
        default:
          break;
      }
    };

    if (!closeDepth(globalMenuTabKey, "global-menu", action)) {
      setIsGlobalMenuOpen(false);
      action();
    }
  };

  const handleLogout = useCallback(() => {
    const action = () => {
      logout();
    };

    if (!closeDepth(globalMenuTabKey, "global-menu", action)) {
      setIsGlobalMenuOpen(false);
      action();
    }
  }, [closeDepth, globalMenuTabKey, logout]);

  const handleCreateMatch = () => {
    isCreateMatchQrScannerOpenRef.current = false;
    setMatchesReloadKey((prev) => prev + 1);
    if (
      !closeDepth(createMatchTabKey, "create-match-sheet", () =>
        selectTab("match"),
      )
    ) {
      setIsCreateMatchOpen(false);
      selectTab("match");
    }
  };

  const handleCancelCreateMatch = () => {
    isCreateMatchQrScannerOpenRef.current = false;
    if (!closeDepth(createMatchTabKey, "create-match-sheet")) {
      setIsCreateMatchOpen(false);
    }
  };

  const handleCreateMatchQrScannerOpenChange = useCallback(
    (isOpen: boolean) => {
      isCreateMatchQrScannerOpenRef.current = isOpen;
    },
    [],
  );

  const navigationContextValue = useMemo(
    () => ({
      selectedTab,
      depthStacks,
      pushDepth,
      closeDepth,
      requestCloseTopDepth,
      saveScrollPosition,
      restoreScrollTop,
      scrollToTop,
      getScrollTop,
    }),
    [
      closeDepth,
      depthStacks,
      getScrollTop,
      pushDepth,
      requestCloseTopDepth,
      restoreScrollTop,
      saveScrollPosition,
      scrollToTop,
      selectedTab,
    ],
  );

  return (
    <TabNavigationProvider value={navigationContextValue}>
      <Tabs
        selectedKey={selectedTab}
        onSelectionChange={handleSelectionChange}
        className="relative flex h-full max-w-full flex-col overflow-hidden bg-white pb-[env(safe-area-inset-bottom)]"
      >
        <div className="app-fixed-bottom fixed left-1/2 z-20 flex app-shell-fixed-width -translate-x-1/2 items-end gap-3 px-3 pb-3 pt-2">
          <Tabs.ListContainer className="min-w-0 flex-1 border-0 bg-transparent p-0 shadow-none backdrop-blur-0">
            <Tabs.List
              aria-label="Bottom navigation"
              className="grid grid-cols-3 gap-1 *:min-w-0"
            >
              <Tabs.Tab
                id="match"
                onClick={() => handleActiveTabClick("match")}
                className="w-full text-default-500 data-[selected=true]:text-[#409eff]"
              >
                <div className="flex flex-col items-center gap-0.5 py-1">
                  <IoTennisballOutline className="text-base" />
                  <span className="text-[11px] leading-none">Matches</span>
                </div>
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab
                id="members"
                onClick={() => handleActiveTabClick("members")}
                className="w-full text-default-500 data-[selected=true]:text-[#409eff]"
              >
                <div className="flex flex-col items-center gap-0.5 py-1">
                  <IoPeopleOutline className="text-base" />
                  <span className="text-[11px] leading-none">Members</span>
                </div>
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab
                id="me"
                onClick={() => handleActiveTabClick("me")}
                className="w-full text-default-500 data-[selected=true]:text-[#409eff]"
              >
                <div className="flex flex-col items-center gap-0.5 py-1">
                  <IoPersonCircleOutline className="text-base" />
                  <span className="text-[11px] leading-none">Me</span>
                </div>
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>

          <Dropdown
            isOpen={isGlobalMenuOpen}
            onOpenChange={handleGlobalMenuOpenChange}
          >
            <Button
              isIconOnly
              aria-label="Global plus menu"
              className={`shrink-0 rounded-full text-white shadow-lg transition-colors ${
                isGlobalMenuOpen
                  ? "bg-[#f8626c] hover:bg-[#f8626c]/90"
                  : "bg-[#409eff] hover:bg-[#409eff]/90"
              }`}
            >
              <IoAdd
                size={20}
                className={`transition-transform duration-200 ${
                  isGlobalMenuOpen ? "rotate-45" : "rotate-0"
                }`}
              />
            </Button>
            <Dropdown.Popover
              className="relative min-w-[180px] overflow-hidden border border-border bg-white"
              offset={12}
              placement="top end"
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[rgba(255,205,0,0.07)]"
              />
              <Dropdown.Menu
                onAction={handleGlobalAction}
                className="relative z-10 bg-transparent"
              >
                <Dropdown.Item
                  id="qr"
                  textValue="QR code"
                  isDisabled={!isOnline}
                >
                  <IoQrCodeSharp className="size-4 shrink-0 text-amber-700" />
                  <Label>QR 코드</Label>
                </Dropdown.Item>
                <Dropdown.Item
                  id="create-match"
                  textValue="Create match"
                  isDisabled={!isOnline}
                >
                  <IoAddCircleOutline className="size-4 shrink-0 text-amber-700" />
                  <Label>매치 생성</Label>
                </Dropdown.Item>
              </Dropdown.Menu>
              <Separator className="my-1" />
              <div className="relative z-10 px-1 pb-1">
                <HoldToConfirmButton
                  holdDurationMs={1000}
                  ariaLabel="길게 눌러 로그아웃"
                  onComplete={handleLogout}
                  className="rounded-lg text-[#f8626c] hover:bg-[#f8626c]/6"
                  progressClassName="bg-[#f8626c]/18"
                >
                  <IoLogOutOutline className="size-4 shrink-0 text-[#f8626c]" />
                  <span className="truncate text-sm font-medium text-[#f8626c]">
                    길게 눌러 로그아웃
                  </span>
                </HoldToConfirmButton>
              </div>
            </Dropdown.Popover>
          </Dropdown>
        </div>

        <div
          ref={scrollContainerRef}
          className="app-scroll-area app-tab-panel-scroll-area flex-1"
        >
          <Tabs.Panel
            id="match"
            className="app-panel-bottom-pad min-h-full bg-gray-50"
          >
            <Matches reloadKey={matchesReloadKey} />
          </Tabs.Panel>
          <Tabs.Panel
            id="members"
            className="app-panel-bottom-pad min-h-full bg-gray-50"
          >
            <Members />
          </Tabs.Panel>
          <Tabs.Panel
            id="me"
            className="app-panel-bottom-pad min-h-full bg-white"
          >
            <Me />
          </Tabs.Panel>
          {/* <div
            aria-hidden="true"
            className="h-[calc(5.5rem+env(safe-area-inset-bottom))] shrink-0"
          /> */}
        </div>

        <div
          aria-hidden="true"
          className="app-bottom-overlay-height pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-white via-white/100 to-transparent"
        />

        <BottomSheet
          isOpen={isQrOpen}
          onOpenChange={handleQrOpenChange}
          ariaLabel="Player QR code"
        >
          <PlayerQrSheetBody
            qrToken={qrToken}
            qrRemainingSeconds={qrRemainingSeconds}
            qrError={qrError}
            isQrLoading={isQrLoading}
            onRefresh={handleRefreshPlayerQrToken}
          />
        </BottomSheet>

        <BottomSheet
          isOpen={isCreateMatchOpen}
          onOpenChange={handleCreateMatchOpenChange}
          ariaLabel="Create match"
        >
          <CreateMatchDrawerBody
            onCreateMatch={handleCreateMatch}
            onCancel={handleCancelCreateMatch}
            onQrScannerOpenChange={handleCreateMatchQrScannerOpenChange}
            isOnline={isOnline}
          />
        </BottomSheet>
      </Tabs>
    </TabNavigationProvider>
  );
};

export default BottomNav;
