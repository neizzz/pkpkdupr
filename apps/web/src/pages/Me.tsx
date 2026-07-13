import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@heroui/react";
import { IoSettingsOutline } from "react-icons/io5";
import BottomSheet from "@/components/BottomSheet";
import type { MatchInfo } from "@/components/Match";
import MemberProfile from "@/components/MemberProfile";
import ProfileSettingsSheetBody from "@/components/ProfileSettingsSheetBody";
import TabPanelStatus from "@/components/TabPanelStatus";
import { useAuth } from "@/context/AuthContext";
import { useTabNavigation } from "@/context/TabNavigationContext";
import { buildApiUrl } from "@/lib/api";
import { isTabRefreshDue } from "@/lib/tabRefresh";
import { buildMatchStats, createEmptyMatchStats } from "@/utils/matchStats";

const Me: React.FC = () => {
  const { player, token } = useAuth();
  const { closeDepth, pushDepth, selectedTab } = useTabNavigation();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [matchStats, setMatchStats] = useState(createEmptyMatchStats);
  const [isMatchStatsLoading, setIsMatchStatsLoading] = useState(true);
  const lastSuccessfulLoadAtRef = useRef<number | null>(null);
  const wasTabActiveRef = useRef(false);
  const playerId = player?.id;

  const closeSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  const loadMatchStats = useCallback(
    async (signal: AbortSignal, preserveVisibleData = false) => {
      if (!token || !playerId) {
        lastSuccessfulLoadAtRef.current = null;
        setMatchStats(createEmptyMatchStats());
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
          lastSuccessfulLoadAtRef.current = Date.now();
        }
      } catch {
        if (!signal.aborted && !preserveVisibleData) {
          setMatchStats(createEmptyMatchStats());
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

    return () => abortController.abort();
  }, [loadMatchStats, selectedTab]);

  useEffect(() => {
    if (!token || !playerId) {
      lastSuccessfulLoadAtRef.current = null;
      setMatchStats(createEmptyMatchStats());
      setIsMatchStatsLoading(false);
    }
  }, [playerId, token]);

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

    if (!closeDepth("me", "me-settings")) {
      setIsSettingsOpen(false);
    }
  };

  const settingsButton = (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className="rounded-full px-3 text-amber-700"
      onPress={openSettings}
    >
      <IoSettingsOutline className="size-4" />
      설정
    </Button>
  );

  return (
    <>
      {isMatchStatsLoading ? (
        <TabPanelStatus ariaLabel="내 프로필 로딩 중" isLoading />
      ) : (
        <MemberProfile
          player={player}
          isMe
          showDetailHeader={false}
          headerAction={settingsButton}
          matchStats={matchStats}
        />
      )}

      <BottomSheet
        isOpen={isSettingsOpen}
        isActive={selectedTab === "me"}
        onOpenChange={handleSettingsOpenChange}
        ariaLabel="프로필 설정"
        className="px-5 pt-6"
      >
        <ProfileSettingsSheetBody />
      </BottomSheet>
    </>
  );
};

export default Me;
