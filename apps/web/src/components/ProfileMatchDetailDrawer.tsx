import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@heroui/react";
import type { MatchInfo } from "@/components/Match";
import MatchDetail, {
  MatchDetailSkeleton,
} from "@/components/MatchDetail";
import DetailPageHeader from "@/components/DetailPageHeader";
import RightDrawer from "@/components/RightDrawer";
import TabPanelStatus from "@/components/TabPanelStatus";
import { useAuth } from "@/context/AuthContext";
import type { TabKey } from "@/context/TabNavigationContext";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { buildApiUrl } from "@/lib/api";

interface ProfileMatchDetailDrawerProps {
  isOpen: boolean;
  isActive: boolean;
  tabKey: TabKey;
  match: MatchInfo | null;
  currentPlayerId?: string;
  onExited: () => void;
  onScrollContainerChange: (element: HTMLDivElement | null) => void;
  layer: number;
}

const ProfileMatchDetailDrawer: React.FC<ProfileMatchDetailDrawerProps> = ({
  isOpen,
  isActive,
  tabKey,
  match,
  currentPlayerId,
  onExited,
  onScrollContainerChange,
  layer,
}) => {
  const { token } = useAuth();
  const isOnline = useOnlineStatus();
  const [displayedMatch, setDisplayedMatch] = useState<MatchInfo | null>(match);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const loadMatchDetail = useCallback(
    async (matchId: string) => {
      if (!token || !isOnline) return;

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(buildApiUrl(`/api/matches/${matchId}`), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "매치를 불러오지 못했습니다.");
        }

        const nextMatch = (await res.json()) as MatchInfo;
        if (requestIdRef.current === requestId) {
          setDisplayedMatch(nextMatch);
        }
      } catch (err) {
        if (requestIdRef.current === requestId) {
          setError(
            err instanceof Error ? err.message : "매치를 불러오지 못했습니다.",
          );
        }
      } finally {
        if (requestIdRef.current === requestId) {
          setIsLoading(false);
        }
      }
    },
    [isOnline, token],
  );

  useEffect(() => {
    requestIdRef.current += 1;
    setDisplayedMatch(match);
    setError(null);
    setIsLoading(false);

    if (isOpen && match) {
      void loadMatchDetail(match.id);
    }
  }, [isOpen, loadMatchDetail, match]);

  let content: React.ReactNode;
  if (displayedMatch) {
    content = (
      <>
        {error ? (
          <div className="px-2 pt-2">
            <TabPanelStatus message={error} tone="error" />
            {isOnline && match ? (
              <Button
                type="button"
                className="app-action-button w-full rounded-2xl bg-pkpk-primary-bg font-semibold text-pkpk-primary-font hover:bg-pkpk-primary-bg/90"
                onPress={() => void loadMatchDetail(match.id)}
              >
                다시 시도
              </Button>
            ) : null}
          </div>
        ) : null}
        <MatchDetail
          match={displayedMatch}
          tabKey={tabKey}
          currentPlayerId={currentPlayerId}
          onAutoApprovalDue={() => {
            void loadMatchDetail(displayedMatch.id);
          }}
          isLoading={isLoading}
        />
      </>
    );
  } else if (isLoading) {
    content = <MatchDetailSkeleton />;
  } else {
    content = (
      <div className="min-h-full">
        <DetailPageHeader title="Match Detail" tabKey={tabKey} />
        <TabPanelStatus message="매치를 불러오지 못했습니다." tone="error" />
      </div>
    );
  }

  return (
    <RightDrawer
      isOpen={isOpen}
      isActive={isActive}
      ariaLabel="매치 상세"
      onExited={onExited}
      onScrollContainerChange={onScrollContainerChange}
      layer={layer}
    >
      {content}
    </RightDrawer>
  );
};

export default ProfileMatchDetailDrawer;
