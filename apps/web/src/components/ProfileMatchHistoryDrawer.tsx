import React from "react";
import ProfileIdentityLabel from "@/components/ProfileIdentityLabel";
import type { MatchInfo } from "@/components/Match";
import DetailPageHeader from "@/components/DetailPageHeader";
import LoadMoreButton from "@/components/LoadMoreButton";
import ProfileMatchList, {
  type ProfileMatchListItem,
} from "@/components/ProfileMatchList";
import RightDrawer from "@/components/RightDrawer";
import TabPanelEmptyState from "@/components/TabPanelEmptyState";
import type { TabKey } from "@/context/TabNavigationContext";

interface ProfileMatchHistoryDrawerProps {
  isOpen: boolean;
  isActive: boolean;
  tabKey: TabKey;
  profileName?: string;
  profileAvatarUrl?: string;
  matches: ProfileMatchListItem[];
  isLoading?: boolean;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  onPullToRefresh?: () => Promise<void>;
  onPressMatch: (match: MatchInfo) => void;
  onExited: () => void;
  onScrollContainerChange: (element: HTMLDivElement | null) => void;
  layer: number;
}

const ProfileMatchHistoryDrawer: React.FC<ProfileMatchHistoryDrawerProps> = ({
  isOpen,
  isActive,
  tabKey,
  profileName,
  profileAvatarUrl,
  matches,
  isLoading = false,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  onPullToRefresh,
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
    onPullToRefresh={onPullToRefresh}
    layer={layer}
    className="!bg-white"
  >
    <div className="flex min-h-full flex-col bg-white">
      <DetailPageHeader
        title="전체 매치"
        tabKey={tabKey}
        backgroundClassName="bg-white"
        leftContent={
          <ProfileIdentityLabel
            avatarUrl={profileAvatarUrl}
            name={profileName}
            className="text-pkpk-primary-bg"
          />
        }
      />
      {!isLoading && matches.length === 0 ? (
        <TabPanelEmptyState message="완료된 매치가 없어요." />
      ) : (
        <div className="p-2">
          <ProfileMatchList
            matches={matches}
            isLoading={isLoading && matches.length === 0}
            variant="plain"
            emptyMessage="완료된 매치가 없어요."
            onPressMatch={onPressMatch}
          />
          {hasMore || isLoadingMore ? (
            <LoadMoreButton isLoading={isLoadingMore} onPress={onLoadMore} />
          ) : null}
        </div>
      )}
    </div>
  </RightDrawer>
);

export default ProfileMatchHistoryDrawer;
