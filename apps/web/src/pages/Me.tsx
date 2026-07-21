import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@heroui/react";
import { IoSettingsOutline } from "react-icons/io5";
import BottomSheet from "@/components/BottomSheet";
import type { MatchInfo } from "@/components/Match";
import MemberProfile from "@/components/MemberProfile";
import ProfileSettingsSheetBody from "@/components/ProfileSettingsSheetBody";
import TabPanelHeader from "@/components/TabPanelHeader";
import { useAuth } from "@/context/AuthContext";
import { useTabNavigation } from "@/context/TabNavigationContext";
import { buildApiUrl } from "@/lib/api";
import { isTabRefreshDue } from "@/lib/tabRefresh";
import {
  buildMatchStats,
  buildRatingDelta,
  createEmptyMatchStats,
  createEmptyRatingDelta,
} from "@/utils/matchStats";

const Me: React.FC = () => {
  const { player, token, refreshMe } = useAuth();
  const { closeDepth, pushDepth, selectedTab, registerPullToRefresh } =
    useTabNavigation();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [matchStats, setMatchStats] = useState(createEmptyMatchStats);
  const [ratingDelta, setRatingDelta] = useState(createEmptyRatingDelta);
  const [isMatchStatsLoading, setIsMatchStatsLoading] = useState(true);
  const lastSuccessfulLoadAtRef = useRef<number | null>(null);
  const wasTabActiveRef = useRef(false);
  const playerId = player?.id;

  const closeSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  const loadMatchStats = useCallback(
    async (
      signal: AbortSignal,
      preserveVisibleData = false,
      throwOnError = false,
    ) => {
      if (!token || !playerId) {
        lastSuccessfulLoadAtRef.current = null;
        setMatchStats(createEmptyMatchStats());
        setRatingDelta(createEmptyRatingDelta());
        setIsMatchStatsLoading(false);
        return;
      }

      if (!preserveVisibleData) {
        setIsMatchStatsLoading(true);
      }

      try {
        const searchParams = new URLSearchParams({
          playerId,
          limit: "1000",
        });
        const res = await fetch(
          buildApiUrl(`/api/matches?${searchParams.toString()}`),
          {
            headers: { Authorization: `Bearer ${token}` },
            signal,
          },
        );

        if (!res.ok) {
          throw new Error("매치 목록을 불러오지 못했습니다.");
        }

        const data = (await res.json()) as {
          matches: MatchInfo[];
          total: number;
        };

        if (!signal.aborted) {
          setMatchStats(buildMatchStats(data.matches, playerId));
          setRatingDelta(buildRatingDelta(data.matches, playerId));
          lastSuccessfulLoadAtRef.current = Date.now();
        }
      } catch {
        if (!signal.aborted && !preserveVisibleData) {
          setMatchStats(createEmptyMatchStats());
          setRatingDelta(createEmptyRatingDelta());
        }
        if (!signal.aborted && throwOnError) {
          throw new Error("내 경기 통계를 새로고침하지 못했습니다.");
        }
      } finally {
        if (!signal.aborted && !preserveVisibleData) {
          setIsMatchStatsLoading(false);
        }
      }
    },
    [playerId, token],
  );

  useEffect(() => {
    const isTabActive = selectedTab === "me";
    if (!isTabActive) {
      wasTabActiveRef.current = false;
      return;
    }

    if (wasTabActiveRef.current) return;

    wasTabActiveRef.current = true;
    if (!isTabRefreshDue(lastSuccessfulLoadAtRef.current)) return;

    const abortController = new AbortController();
    void loadMatchStats(
      abortController.signal,
      lastSuccessfulLoadAtRef.current !== null,
    );

    return () => {
      abortController.abort();
      // React Strict Mode와 인증 정보 갱신으로 effect가 다시 실행될 때,
      // 취소된 첫 요청 때문에 다음 요청까지 막히지 않도록 한다.
      wasTabActiveRef.current = false;
    };
  }, [loadMatchStats, selectedTab]);

  useEffect(() => {
    if (!token || !playerId) {
      lastSuccessfulLoadAtRef.current = null;
      setMatchStats(createEmptyMatchStats());
      setRatingDelta(createEmptyRatingDelta());
      setIsMatchStatsLoading(false);
    }
  }, [playerId, token]);

  useEffect(
    () =>
      registerPullToRefresh("me", async () => {
        await refreshMe();
        const abortController = new AbortController();
        await loadMatchStats(abortController.signal, true, true);
      }),
    [loadMatchStats, refreshMe, registerPullToRefresh],
  );

  const openSettings = () => {
    pushDepth("me", {
      id: "me-settings",
      kind: "bottom-sheet",
      onClose: closeSettings,
    });
    setIsSettingsOpen(true);
  };

  const handleSettingsOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      openSettings();
      return;
    }

    closeDepth("me", "me-settings");
    setIsSettingsOpen(false);
  };

  const settingsButton = (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="rounded-full border-0 px-0 font-bold !text-pkpk-primary-bg"
      onPress={openSettings}
    >
      <IoSettingsOutline className="size-4" />
      설정
    </Button>
  );

  return (
    <>
      <TabPanelHeader title="Me">{settingsButton}</TabPanelHeader>
      <MemberProfile
        player={player}
        isMe
        showDetailHeader={false}
        matchStats={matchStats}
        ratingDelta={ratingDelta}
        isStatsLoading={isMatchStatsLoading}
        showPlayerId
      />

      <BottomSheet
        isOpen={isSettingsOpen}
        isActive={selectedTab === "me"}
        onOpenChange={handleSettingsOpenChange}
        ariaLabel="설정"
        className="px-5 pt-6"
      >
        <ProfileSettingsSheetBody />
      </BottomSheet>
    </>
  );
};

export default Me;
