import React from "react";
import { Button, Spinner } from "@heroui/react";
import type { MatchInfo } from "@/components/Match";
import DetailPageHeader from "@/components/DetailPageHeader";
import ProfileMatchList, {
  type ProfileMatchListItem,
} from "@/components/ProfileMatchList";
import RightDrawer from "@/components/RightDrawer";
import type { TabKey } from "@/context/TabNavigationContext";

interface ProfileMatchHistoryDrawerProps {
  isOpen: boolean;
  isActive: boolean;
  tabKey: TabKey;
  matches: ProfileMatchListItem[];
  isLoading?: boolean;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  onPressMatch: (match: MatchInfo) => void;
  onExited: () => void;
  onScrollContainerChange: (element: HTMLDivElement | null) => void;
  layer: number;
}

const ProfileMatchHistoryDrawer: React.FC<ProfileMatchHistoryDrawerProps> = ({
  isOpen,
  isActive,
  tabKey,
  matches,
  isLoading = false,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  onPressMatch,
  onExited,
  onScrollContainerChange,
  layer,
}) => (
  <RightDrawer
    isOpen={isOpen}
    isActive={isActive}
    ariaLabel="전체 매치"
    onExited={onExited}
    onScrollContainerChange={onScrollContainerChange}
    layer={layer}
    className="!bg-white"
  >
    <div className="min-h-full bg-white">
      <DetailPageHeader
        title="전체 매치"
        tabKey={tabKey}
        backgroundClassName="bg-white"
      />
      <div className="p-2">
        <ProfileMatchList
          matches={matches}
          isLoading={isLoading}
          variant="plain"
          emptyMessage="완료된 매치가 없어요."
          onPressMatch={onPressMatch}
        />
        {hasMore ? (
          <div className="flex justify-center pt-3 pb-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              isDisabled={isLoadingMore}
              onPress={onLoadMore}
            >
              {isLoadingMore ? <Spinner size="sm" /> : "더 보기"}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  </RightDrawer>
);

export default ProfileMatchHistoryDrawer;
