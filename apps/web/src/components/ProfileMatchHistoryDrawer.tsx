import React from "react";
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
  >
    <div className="min-h-full">
      <DetailPageHeader title="전체 매치" tabKey={tabKey} />
      <div className="p-2">
        <ProfileMatchList
          matches={matches}
          isLoading={isLoading}
          emptyMessage="완료된 매치가 없어요."
          onPressMatch={onPressMatch}
        />
      </div>
    </div>
  </RightDrawer>
);

export default ProfileMatchHistoryDrawer;
