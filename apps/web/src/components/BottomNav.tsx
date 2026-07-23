import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  Alert,
  Button,
  CloseButton,
  Dropdown,
  Label,
  Separator,
  Tabs,
} from "@heroui/react";
import {
  IoAdd,
  IoAddCircleOutline,
  IoLogOutOutline,
  IoPeopleOutline,
  IoPersonCircleOutline,
  IoQrCodeSharp,
  IoSettingsOutline,
  IoTennisballOutline,
} from "react-icons/io5";
import AppSettingsSheetBody from "@/components/AppSettingsSheetBody";
import type { PlayerQrTokenResponse } from "@pkpkdupr/shared/qr";
import BottomSheet from "@/components/BottomSheet";
import CreateMatchDrawerBody from "@/components/CreateMatchDrawerBody";
import HoldToConfirmButton from "@/components/HoldToConfirmButton";
import PlayerQrSheetBody from "@/components/PlayerQrSheetBody";
import PullToRefreshIndicator, {
  type PullToRefreshStatus,
} from "@/components/PullToRefreshIndicator";
import { useAuth } from "@/context/AuthContext";
import {
  TabNavigationProvider,
  type TabDepthEntry,
  type TabDepthStacks,
  type TabKey,
  type PullToRefreshHandler,
} from "@/context/TabNavigationContext";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { buildApiUrl } from "@/lib/api";
import Matches from "@/pages/Matches";
import Members from "@/pages/Members";
import Me from "@/pages/Me";

const TAB_KEYS: TabKey[] = ["match", "members", "me"];
const DEFAULT_THEME_COLOR = "#f8f9fa";
const DIMMED_THEME_COLOR = "#aeaeaf";
const TAB_THEME_COLOR_MAP: Record<TabKey, string> = {
  match: DEFAULT_THEME_COLOR,
  members: DEFAULT_THEME_COLOR,
  me: DEFAULT_THEME_COLOR,
};

const emptyDepthStacks = (): TabDepthStacks => ({
  match: [],
  members: [],
  me: [],
});

const initiallyVisitedTabs = (): Record<TabKey, boolean> => ({
  match: false,
  members: false,
  me: true,
});

const HISTORY_DEPTH_STATE_KEY = "__pkpkduprTabDepth";
const PULL_TO_REFRESH_THRESHOLD = 108;
const PULL_TO_REFRESH_BASE_RESISTANCE = 0.55;
const PULL_TO_REFRESH_MIN_RESISTANCE = 0.4;
const PULL_TO_REFRESH_SLOW_REQUEST_MS = 8_000;
const PULL_GESTURE_DIRECTION_THRESHOLD = 8;

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
  const [visitedTabs, setVisitedTabs] =
    useState<Record<TabKey, boolean>>(initiallyVisitedTabs);
  const [depthStacks, setDepthStacks] =
    useState<TabDepthStacks>(emptyDepthStacks);
  const [isGlobalMenuOpen, setIsGlobalMenuOpen] = useState(false);
  const [globalMenuTabKey, setGlobalMenuTabKey] = useState<TabKey>("me");
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [qrTabKey, setQrTabKey] = useState<TabKey>("me");
  const [isCreateMatchOpen, setIsCreateMatchOpen] = useState(false);
  const [createMatchTabKey, setCreateMatchTabKey] = useState<TabKey>("me");
  const [isAppSettingsOpen, setIsAppSettingsOpen] = useState(false);
  const [appSettingsTabKey, setAppSettingsTabKey] = useState<TabKey>("me");
  const [matchesReloadKey, setMatchesReloadKey] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [pullToRefreshStatus, setPullToRefreshStatus] =
    useState<PullToRefreshStatus>("idle");
  const [isPullRefreshSlow, setIsPullRefreshSlow] = useState(false);
  const isCreateMatchQrScannerOpenRef = useRef(false);
  const [qrToken, setQrToken] = useState<PlayerQrTokenResponse | null>(null);
  const [isQrLoading, setIsQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrRemainingSeconds, setQrRemainingSeconds] = useState(0);
  const [
    createMatchQrScannerCloseRequestKey,
    setCreateMatchQrScannerCloseRequestKey,
  ] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const selectedTabRef = useRef<TabKey>(selectedTab);
  const depthEntriesRef = useRef<Record<TabKey, TabDepthEntry[]>>({
    match: [],
    members: [],
    me: [],
  });
  const scrollPositionsRef = useRef<Record<string, number>>({});
  const historySequenceRef = useRef(0);
  const currentHistoryDepthRef = useRef<TabDepthHistoryState | null>(null);
  const afterCloseCallbacksRef = useRef(new Map<string, () => void>());
  const closingDepthKeysRef = useRef(new Set<string>());
  const pullToRefreshHandlersRef = useRef<
    Partial<Record<TabKey, PullToRefreshHandler>>
  >({});
  const pullStartRef = useRef<{
    identifier: number;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
  } | null>(null);
  const pullDistanceRef = useRef(0);
  const isPullGestureActiveRef = useRef(false);
  const pullGestureAxisRef = useRef<"undecided" | "vertical" | "horizontal">(
    "undecided",
  );
  const isPullRefreshingRef = useRef(false);
  const pullRefreshRequestIdRef = useRef(0);
  const pullStatusTimeoutRef = useRef<number | null>(null);
  const pullSlowRequestTimeoutRef = useRef<number | null>(null);

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

  const getScrollPositionKey = useCallback((tabKey: TabKey) => {
    const tabDepthStack = depthEntriesRef.current[tabKey];
    const activeDepth = tabDepthStack[tabDepthStack.length - 1];

    return `${tabKey}:${activeDepth?.id ?? "root"}`;
  }, []);

  const saveScrollPosition = useCallback(
    (tabKey = selectedTabRef.current) => {
      scrollPositionsRef.current[getScrollPositionKey(tabKey)] = getScrollTop();
    },
    [getScrollPositionKey, getScrollTop],
  );

  const restoreScrollTop = useCallback(
    (tabKey = selectedTabRef.current) => {
      const scrollPositionKey = getScrollPositionKey(tabKey);

      window.requestAnimationFrame(() => {
        if (selectedTabRef.current !== tabKey) return;

        const scrollContainer = scrollContainerRef.current;
        if (!scrollContainer) return;

        scrollContainer.scrollTop =
          scrollPositionsRef.current[scrollPositionKey] ?? 0;
      });
    },
    [getScrollPositionKey],
  );

  const scrollToTop = useCallback((behavior: ScrollBehavior = "smooth") => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior });
  }, []);

  const registerPullToRefresh = useCallback(
    (tabKey: TabKey, handler: PullToRefreshHandler) => {
      pullToRefreshHandlersRef.current[tabKey] = handler;

      return () => {
        if (pullToRefreshHandlersRef.current[tabKey] === handler) {
          delete pullToRefreshHandlersRef.current[tabKey];
        }
      };
    },
    [],
  );

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
        const historyState = {
          [HISTORY_DEPTH_STATE_KEY]: true,
          tabKey,
          depthId: entry.id,
          sequence: historySequenceRef.current,
        } satisfies TabDepthHistoryState;
        window.history.pushState(historyState, "", window.location.href);
        currentHistoryDepthRef.current = historyState;
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
      setVisitedTabs((currentVisitedTabs) =>
        currentVisitedTabs[nextTab]
          ? currentVisitedTabs
          : { ...currentVisitedTabs, [nextTab]: true },
      );
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

  // Capture the pre-selection tab before HeroUI handles the press so moving to
  // a tab cannot be mistaken for a re-tap.
  const handleActiveTabPointerDown = useCallback(
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

  const openAppSettingsSheet = useCallback(() => {
    const tabKey = selectedTabRef.current;
    setAppSettingsTabKey(tabKey);
    pushDepth(tabKey, {
      id: "app-settings-sheet",
      kind: "bottom-sheet",
      onClose: () => setIsAppSettingsOpen(false),
    });
    setIsAppSettingsOpen(true);
  }, [pushDepth]);

  const handleGlobalMenuOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        openGlobalMenu();
        return;
      }

      closeDepth(globalMenuTabKey, "global-menu");
      setIsGlobalMenuOpen(false);
    },
    [closeDepth, globalMenuTabKey, openGlobalMenu],
  );

  const handleQrOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        openQrSheet();
        return;
      }

      closeDepth(qrTabKey, "qr-sheet");
      setIsQrOpen(false);
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
        setCreateMatchQrScannerCloseRequestKey((prev) => prev + 1);
        return;
      }

      closeDepth(createMatchTabKey, "create-match-sheet");
      setIsCreateMatchOpen(false);
    },
    [closeDepth, createMatchTabKey, openCreateMatchSheet],
  );

  const handleAppSettingsOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        openAppSettingsSheet();
        return;
      }

      closeDepth(appSettingsTabKey, "app-settings-sheet");
      setIsAppSettingsOpen(false);
    },
    [appSettingsTabKey, closeDepth, openAppSettingsSheet],
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
    const handlePopState = (event: PopStateEvent) => {
      const historyDepth = currentHistoryDepthRef.current;
      // Set the destination before running an entry's close callback. A close
      // callback can immediately open another layer (for example, replacing
      // the global menu with a bottom sheet), which pushes a new history state.
      // Updating this ref afterwards would overwrite that new state with the
      // old destination and make the next OS back close the covered depth.
      currentHistoryDepthRef.current = isTabDepthHistoryState(event.state)
        ? event.state
        : null;

      if (historyDepth) {
        removeDepthEntry(historyDepth.tabKey, historyDepth.depthId);
      } else {
        const activeTab = selectedTabRef.current;
        const activeStack = depthEntriesRef.current[activeTab];
        const topEntry = activeStack[activeStack.length - 1];

        if (topEntry) {
          removeDepthEntry(activeTab, topEntry.id);
        }
      }
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
        case "settings":
          openAppSettingsSheet();
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

  const isGlobalMenuVisible =
    isGlobalMenuOpen && globalMenuTabKey === selectedTab;
  const isDimmedOverlayVisible =
    isGlobalMenuVisible ||
    (isQrOpen && qrTabKey === selectedTab) ||
    (isCreateMatchOpen && createMatchTabKey === selectedTab) ||
    (isAppSettingsOpen && appSettingsTabKey === selectedTab);
  const hasBlockingLayer = useMemo(() => {
    const activeDepthEntries = depthEntriesRef.current[selectedTab];
    const hasBlockingDepth = activeDepthEntries.some(
      (entry) => entry.kind === "bottom-sheet" || entry.kind === "dropdown",
    );

    return (
      hasBlockingDepth ||
      isGlobalMenuVisible ||
      (isQrOpen && qrTabKey === selectedTab) ||
      (isCreateMatchOpen && createMatchTabKey === selectedTab) ||
      (isAppSettingsOpen && appSettingsTabKey === selectedTab)
    );
  }, [
    appSettingsTabKey,
    createMatchTabKey,
    depthStacks,
    isAppSettingsOpen,
    isCreateMatchOpen,
    isGlobalMenuVisible,
    isQrOpen,
    qrTabKey,
    selectedTab,
  ]);

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

    themeColorMeta.setAttribute(
      "content",
      isDimmedOverlayVisible
        ? DIMMED_THEME_COLOR
        : TAB_THEME_COLOR_MAP[selectedTab],
    );

    return () => {
      themeColorMeta.setAttribute("content", DEFAULT_THEME_COLOR);
    };
  }, [isDimmedOverlayVisible, selectedTab]);

  const resetPullToRefresh = useCallback(
    (status: PullToRefreshStatus = "idle") => {
      pullStartRef.current = null;
      pullDistanceRef.current = 0;
      isPullGestureActiveRef.current = false;
      pullGestureAxisRef.current = "undecided";
      if (scrollContainerRef.current) {
        scrollContainerRef.current.style.overflow = "";
      }
      setPullDistance(0);
      setPullToRefreshStatus(status);
    },
    [],
  );

  const schedulePullToRefreshReset = useCallback(
    (status: PullToRefreshStatus, delay: number) => {
      if (pullStatusTimeoutRef.current != null) {
        window.clearTimeout(pullStatusTimeoutRef.current);
      }
      pullStatusTimeoutRef.current = window.setTimeout(() => {
        pullStatusTimeoutRef.current = null;
        isPullRefreshingRef.current = false;
        resetPullToRefresh();
      }, delay);
      setPullToRefreshStatus(status);
    },
    [resetPullToRefresh],
  );

  const clearPullRefreshSlowWarning = useCallback(() => {
    if (pullSlowRequestTimeoutRef.current != null) {
      window.clearTimeout(pullSlowRequestTimeoutRef.current);
      pullSlowRequestTimeoutRef.current = null;
    }
    setIsPullRefreshSlow(false);
  }, []);

  const cancelPullToRefresh = useCallback(() => {
    pullRefreshRequestIdRef.current += 1;
    if (pullStatusTimeoutRef.current != null) {
      window.clearTimeout(pullStatusTimeoutRef.current);
      pullStatusTimeoutRef.current = null;
    }
    clearPullRefreshSlowWarning();
    isPullRefreshingRef.current = false;
    resetPullToRefresh();
  }, [clearPullRefreshSlowWarning, resetPullToRefresh]);

  useEffect(() => {
    cancelPullToRefresh();
  }, [cancelPullToRefresh, selectedTab]);

  useEffect(
    () => () => {
      if (pullStatusTimeoutRef.current != null) {
        window.clearTimeout(pullStatusTimeoutRef.current);
      }
      if (pullSlowRequestTimeoutRef.current != null) {
        window.clearTimeout(pullSlowRequestTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const handleTouchStart = (event: TouchEvent) => {
      if (
        event.touches.length !== 1 ||
        isPullRefreshingRef.current ||
        hasBlockingLayer ||
        !pullToRefreshHandlersRef.current[selectedTab] ||
        (scrollContainer.scrollTop ?? 0) > 0
      ) {
        return;
      }

      const touch = event.touches[0];
      pullStartRef.current = {
        identifier: touch.identifier,
        startX: touch.clientX,
        startY: touch.clientY,
        lastX: touch.clientX,
        lastY: touch.clientY,
      };
      pullDistanceRef.current = 0;
      isPullGestureActiveRef.current = false;
      pullGestureAxisRef.current = "undecided";
    };

    const preventScrollWhilePullIndicatorVisible = (event: TouchEvent) => {
      if (pullStartRef.current && isPullGestureActiveRef.current) {
        if (event.cancelable) {
          event.preventDefault();
        }
      }
    };

    scrollContainer.addEventListener("touchstart", handleTouchStart, {
      passive: false,
    });
    scrollContainer.addEventListener(
      "touchmove",
      preventScrollWhilePullIndicatorVisible,
      { passive: false },
    );

    return () => {
      scrollContainer.removeEventListener("touchstart", handleTouchStart);
      scrollContainer.removeEventListener(
        "touchmove",
        preventScrollWhilePullIndicatorVisible,
      );
    };
  }, [hasBlockingLayer, selectedTab]);

  const updatePullDistance = useCallback(
    (touch: React.Touch) => {
      const start = pullStartRef.current;
      if (!start || hasBlockingLayer || isPullRefreshingRef.current) {
        return false;
      }

      if (pullGestureAxisRef.current !== "vertical") {
        const totalDeltaX = touch.clientX - start.startX;
        const totalDeltaY = touch.clientY - start.startY;
        if (
          Math.max(Math.abs(totalDeltaX), Math.abs(totalDeltaY)) <
          PULL_GESTURE_DIRECTION_THRESHOLD
        ) {
          return true;
        }

        if (Math.abs(totalDeltaX) > Math.abs(totalDeltaY)) {
          pullGestureAxisRef.current = "horizontal";
          resetPullToRefresh();
          return false;
        }

        pullGestureAxisRef.current = "vertical";
      }

      const deltaY = touch.clientY - start.lastY;
      pullStartRef.current = {
        ...start,
        lastX: touch.clientX,
        lastY: touch.clientY,
      };

      const pullProgress = Math.min(
        pullDistanceRef.current / PULL_TO_REFRESH_THRESHOLD,
        1,
      );
      const downwardResistance =
        PULL_TO_REFRESH_BASE_RESISTANCE -
        (PULL_TO_REFRESH_BASE_RESISTANCE - PULL_TO_REFRESH_MIN_RESISTANCE) *
          pullProgress;
      const adjustedDeltaY =
        deltaY > 0
          ? deltaY * downwardResistance
          : deltaY * PULL_TO_REFRESH_BASE_RESISTANCE;
      const distance = Math.min(
        Math.max(0, pullDistanceRef.current + adjustedDeltaY),
        PULL_TO_REFRESH_THRESHOLD * 1.25,
      );
      pullDistanceRef.current = distance;
      if (distance > 0) {
        isPullGestureActiveRef.current = true;
        if (scrollContainerRef.current) {
          scrollContainerRef.current.style.overflow = "hidden";
        }
      }
      setPullDistance(distance);
      setPullToRefreshStatus(
        distance === 0
          ? "idle"
          : distance >= PULL_TO_REFRESH_THRESHOLD
            ? "armed"
            : "pulling",
      );
      return true;
    },
    [hasBlockingLayer, resetPullToRefresh],
  );

  const handlePullTouchMove = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      const start = pullStartRef.current;
      if (!start) return;

      if (event.touches.length !== 1) {
        resetPullToRefresh();
        return;
      }

      const touch = Array.from(event.touches).find(
        (candidate) => candidate.identifier === start.identifier,
      );
      if (!touch) return;

      updatePullDistance(touch);
    },
    [resetPullToRefresh, updatePullDistance],
  );

  const handlePullTouchRefresh = useCallback(async () => {
    const shouldRefresh =
      !hasBlockingLayer &&
      pullDistanceRef.current >= PULL_TO_REFRESH_THRESHOLD &&
      !isPullRefreshingRef.current;
    const refreshHandler = pullToRefreshHandlersRef.current[selectedTab];

    if (!shouldRefresh || !refreshHandler) {
      resetPullToRefresh();
      return;
    }

    pullStartRef.current = null;
    pullDistanceRef.current = 0;
    setPullDistance(0);
    isPullRefreshingRef.current = true;
    const requestId = pullRefreshRequestIdRef.current + 1;
    pullRefreshRequestIdRef.current = requestId;
    clearPullRefreshSlowWarning();
    pullSlowRequestTimeoutRef.current = window.setTimeout(() => {
      if (
        pullRefreshRequestIdRef.current === requestId &&
        isPullRefreshingRef.current
      ) {
        setIsPullRefreshSlow(true);
      }
    }, PULL_TO_REFRESH_SLOW_REQUEST_MS);
    setPullToRefreshStatus("refreshing");

    try {
      await refreshHandler();
      if (pullRefreshRequestIdRef.current !== requestId) return;
      clearPullRefreshSlowWarning();
      schedulePullToRefreshReset("refreshing", 350);
    } catch {
      if (pullRefreshRequestIdRef.current !== requestId) return;
      clearPullRefreshSlowWarning();
      schedulePullToRefreshReset("error", 1600);
    }
  }, [
    hasBlockingLayer,
    clearPullRefreshSlowWarning,
    resetPullToRefresh,
    schedulePullToRefreshReset,
    selectedTab,
  ]);

  const handlePullTouchEnd = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      const start = pullStartRef.current;
      if (!start) return;

      const endingTouch = Array.from(event.changedTouches).find(
        (touch) => touch.identifier === start.identifier,
      );
      if (!endingTouch || !updatePullDistance(endingTouch)) return;

      void handlePullTouchRefresh();
    },
    [handlePullTouchRefresh, updatePullDistance],
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
      registerPullToRefresh,
    }),
    [
      closeDepth,
      depthStacks,
      getScrollTop,
      pushDepth,
      requestCloseTopDepth,
      registerPullToRefresh,
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
        className="relative flex h-full w-full flex-col overflow-hidden bg-white pb-[var(--safe-bottom)]"
      >
        <div className="fixed bottom-[calc(var(--safe-bottom)+var(--app-keyboard-offset))] left-1/2 z-20 flex app-shell-width -translate-x-1/2 items-end px-3 pb-3 pt-2">
          <Tabs.ListContainer className="mr-[4.35rem] min-w-0 flex-1 border-0 bg-transparent p-0 shadow-none backdrop-blur-0">
            <Tabs.List
              aria-label="Bottom navigation"
              className="grid grid-cols-3 gap-1 rounded-full shadow-[0_3px_10px_rgba(15,23,42,0.12)] *:min-w-0"
            >
              <Tabs.Tab
                id="match"
                onPointerDownCapture={() =>
                  handleActiveTabPointerDown("match")
                }
                className="min-h-[2.8rem] w-full first:rounded-l-full last:rounded-r-full text-default-500 data-[selected=true]:text-pkpk-primary-bg"
              >
                <div className="flex flex-col items-center gap-0.5 py-1">
                  <IoTennisballOutline className="text-base" />
                  <span className="text-[11px] leading-none">Matches</span>
                </div>
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab
                id="members"
                onPointerDownCapture={() =>
                  handleActiveTabPointerDown("members")
                }
                className="min-h-[2.8rem] w-full text-default-500 data-[selected=true]:text-pkpk-primary-bg"
              >
                <div className="flex flex-col items-center gap-0.5 py-1">
                  <IoPeopleOutline className="text-base" />
                  <span className="text-[11px] leading-none">Members</span>
                </div>
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab
                id="me"
                onPointerDownCapture={() => handleActiveTabPointerDown("me")}
                className="min-h-[2.8rem] w-full first:rounded-l-full last:rounded-r-full text-default-500 data-[selected=true]:text-pkpk-primary-bg"
              >
                <div className="flex flex-col items-center gap-0.5 py-1">
                  <IoPersonCircleOutline className="text-base" />
                  <span className="text-[11px] leading-none">Me</span>
                </div>
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
        </div>

        <div
          ref={scrollContainerRef}
          className="app-tab-panel-scroll-area relative flex-1"
          onTouchMove={handlePullTouchMove}
          onTouchEnd={handlePullTouchEnd}
          onTouchCancel={() => resetPullToRefresh()}
        >
          <PullToRefreshIndicator
            distance={pullDistance}
            status={pullToRefreshStatus}
            threshold={PULL_TO_REFRESH_THRESHOLD}
          />
          {isPullRefreshSlow ? (
            <div className="absolute inset-x-0 top-14 z-30 px-3">
              <Alert
                status="warning"
                className="items-center rounded-2xl border border-amber-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur"
              >
                <Alert.Indicator className="shrink-0 self-center" />
                <Alert.Content className="min-w-0 gap-0 self-center">
                  <Alert.Title className="text-sm font-bold text-pkpk-sub-font">
                    응답이 지연되고 있어요.
                  </Alert.Title>
                  <Alert.Description className="text-xs font-semibold text-[#888]">
                    네트워크 연결 상태를 확인해주세요.
                  </Alert.Description>
                </Alert.Content>
                <CloseButton
                  className="shrink-0 self-center"
                  aria-label="지연 안내 닫기"
                  onClick={() => setIsPullRefreshSlow(false)}
                />
              </Alert>
            </div>
          ) : null}
          <Tabs.Panel
            id="match"
            shouldForceMount={visitedTabs.match}
            className="min-h-full bg-pkpk-bg p-0 pb-[calc(4rem+var(--safe-bottom))] data-[inert=true]:hidden"
          >
            <Matches reloadKey={matchesReloadKey} />
          </Tabs.Panel>
          <Tabs.Panel
            id="members"
            shouldForceMount={visitedTabs.members}
            className="min-h-full bg-pkpk-bg p-0 pb-[calc(4rem+var(--safe-bottom))] data-[inert=true]:hidden"
          >
            <Members />
          </Tabs.Panel>
          <Tabs.Panel
            id="me"
            shouldForceMount={visitedTabs.me}
            className="min-h-full bg-pkpk-bg p-0 pb-[calc(4rem+var(--safe-bottom))] data-[inert=true]:hidden"
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
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[calc(5.5rem+env(safe-area-inset-bottom)+var(--app-keyboard-offset))] bg-gradient-to-t from-white via-white/100 to-transparent"
        />

        <BottomSheet
          isOpen={isQrOpen}
          isActive={qrTabKey === selectedTab}
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
          isActive={createMatchTabKey === selectedTab}
          onOpenChange={handleCreateMatchOpenChange}
          ariaLabel="Create match"
        >
          <CreateMatchDrawerBody
            onCreateMatch={handleCreateMatch}
            onCancel={handleCancelCreateMatch}
            onQrScannerOpenChange={handleCreateMatchQrScannerOpenChange}
            isOnline={isOnline}
            closeQrScannerRequestKey={createMatchQrScannerCloseRequestKey}
          />
        </BottomSheet>

        <BottomSheet
          isOpen={isAppSettingsOpen}
          isActive={appSettingsTabKey === selectedTab}
          onOpenChange={handleAppSettingsOpenChange}
          ariaLabel="앱 설정"
          className="px-5 pt-6"
        >
          <AppSettingsSheetBody />
        </BottomSheet>
      </Tabs>
      {typeof document !== "undefined"
        ? createPortal(
            <div
              className={`pointer-events-none fixed bottom-[calc(var(--safe-bottom)+var(--app-keyboard-offset)+0.75rem)] left-1/2 flex app-shell-width -translate-x-1/2 justify-end px-3 ${
                isGlobalMenuVisible ? "z-[60]" : "z-40"
              }`}
            >
              <div className="pointer-events-auto">
                <Dropdown
                  isOpen={isGlobalMenuVisible}
                  onOpenChange={handleGlobalMenuOpenChange}
                >
                  <Button
                    isIconOnly
                    aria-label="Global plus menu"
                    className={`h-[3.6rem] w-[3.6rem] shrink-0 rounded-full text-white shadow-[0_3px_10px_rgba(15,23,42,0.22)] transition-colors ${
                      isGlobalMenuVisible
                        ? "bg-[#f8626c] hover:bg-[#f8626c]/90"
                        : "bg-pkpk-primary-bg hover:bg-pkpk-primary-bg/90"
                    }`}
                  >
                    <IoAdd
                      className={`h-7 w-7 shrink-0 transition-transform duration-200 ${
                        isGlobalMenuVisible ? "rotate-45" : "rotate-0"
                      }`}
                      style={{ width: "28px", height: "28px" }}
                    />
                  </Button>
                  <Dropdown.Popover
                    className="relative z-[70] min-w-[180px] overflow-hidden border border-border bg-white"
                    offset={12}
                    placement="top end"
                  >
                    <Dropdown.Menu
                      onAction={handleGlobalAction}
                      className="bg-transparent"
                    >
                      <Dropdown.Item
                        id="qr"
                        textValue="QR code"
                        isDisabled={!isOnline}
                      >
                        <IoQrCodeSharp className="size-4 shrink-0 text-pkpk-sub-font" />
                        <Label>QR 코드</Label>
                      </Dropdown.Item>
                      <Dropdown.Item
                        id="create-match"
                        textValue="Create match"
                        isDisabled={!isOnline}
                      >
                        <IoAddCircleOutline className="size-4 shrink-0 text-pkpk-sub-font" />
                        <Label>매치 생성</Label>
                      </Dropdown.Item>
                      <Dropdown.Item id="settings" textValue="Settings">
                        <IoSettingsOutline className="size-4 shrink-0 text-pkpk-sub-font" />
                        <Label>설정</Label>
                      </Dropdown.Item>
                    </Dropdown.Menu>
                    <Separator className="my-1" />
                    <div className="px-1 pb-1">
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
            </div>,
            document.body,
          )
        : null}
      {isGlobalMenuVisible && typeof document !== "undefined"
        ? createPortal(
            <button
              type="button"
              aria-label="전역 메뉴 닫기"
              onClick={() => handleGlobalMenuOpenChange(false)}
              className="fixed inset-0 z-50 cursor-default bg-black/30 backdrop-blur-sm"
            />,
            document.body,
          )
        : null}
    </TabNavigationProvider>
  );
};

export default BottomNav;
