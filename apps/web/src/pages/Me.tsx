import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@heroui/react";
import { IoSettingsOutline } from "react-icons/io5";
import BottomSheet from "@/components/BottomSheet";
import type { MatchInfo } from "@/components/Match";
import MemberProfile from "@/components/MemberProfile";
import ProfileSettingsSheetBody from "@/components/ProfileSettingsSheetBody";
import { useAuth } from "@/context/AuthContext";
import { useTabNavigation } from "@/context/TabNavigationContext";
import { buildMatchStats, createEmptyMatchStats } from "@/utils/matchStats";

const Me: React.FC = () => {
  const { player, token } = useAuth();
  const { closeDepth, pushDepth } = useTabNavigation();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [matchStats, setMatchStats] = useState(createEmptyMatchStats);

  const closeSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  useEffect(() => {
    if (!token || !player?.id) {
      setMatchStats(createEmptyMatchStats());
      return;
    }

    const abortController = new AbortController();

    const loadMatchStats = async () => {
      try {
        const searchParams = new URLSearchParams({
          playerId: player.id,
          limit: "1000",
        });
        const res = await fetch(`/api/matches?${searchParams.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: abortController.signal,
        });

        if (!res.ok) {
          throw new Error("매치 목록을 불러오지 못했습니다.");
        }

        const data = (await res.json()) as {
          matches: MatchInfo[];
          total: number;
        };

        if (!abortController.signal.aborted) {
          setMatchStats(buildMatchStats(data.matches, player.id));
        }
      } catch {
        if (!abortController.signal.aborted) {
          setMatchStats(createEmptyMatchStats());
        }
      }
    };

    void loadMatchStats();

    return () => abortController.abort();
  }, [player?.id, token]);

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
      <MemberProfile
        player={player}
        isMe
        headerAction={settingsButton}
        matchStats={matchStats}
      />

      <BottomSheet
        isOpen={isSettingsOpen}
        onOpenChange={handleSettingsOpenChange}
        ariaLabel="프로필 설정"
        className="px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-6"
      >
        <ProfileSettingsSheetBody />
      </BottomSheet>
    </>
  );
};

export default Me;
