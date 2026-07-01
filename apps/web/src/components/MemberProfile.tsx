import React from "react";
import { Card } from "@heroui/react";
import Avatar from "@/components/Avatar";
import type { PlayerInfo } from "@/context/AuthContext";

interface MemberProfileProps {
  player: PlayerInfo | null;
  memberName?: string;
  isMe: boolean;
  headerAction?: React.ReactNode;
}

const MemberProfile: React.FC<MemberProfileProps> = ({
  player,
  memberName,
  isMe,
  headerAction,
}) => {
  const displayName =
    memberName || player?.username || player?.id || "Unknown Member";
  const duprItems = [
    {
      label: "Total",
      value: player?.duprRating?.total?.toFixed(2) ?? "-",
      valueClassName: "text-lg",
    },
    {
      label: "Singles",
      value: player?.duprRating?.singles?.toFixed(2) ?? "-",
      valueClassName: "text-lg",
    },
    {
      label: "Mixed Doubles",
      value: player?.duprRating?.doubles.mixed?.toFixed(2) ?? "-",
      valueClassName: "text-lg",
    },
    {
      label: "Men / Women",
      value: player?.duprRating
        ? `${player.duprRating.doubles.men.toFixed(2)} / ${player.duprRating.doubles.women.toFixed(2)}`
        : "-",
      valueClassName: "text-sm",
    },
  ];

  return (
    <div className="min-h-full p-2">
      <div className="mx-auto flex w-full max-w-[390px] flex-col gap-3">
        <div className="flex items-start gap-4">
          <Avatar
            size="md"
            avatarUrl={player?.avatarUrl}
            name={displayName}
            isMe={isMe}
          />

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-amber-400">
                  {isMe ? "My Profile" : "Member Profile"}
                </p>
                <h2 className="mt-1 truncate text-2xl font-bold text-amber-950">
                  {displayName}
                </h2>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {isMe && (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                    ME
                  </span>
                )}
                {headerAction}
              </div>
            </div>

            <p className="mt-3 text-sm text-amber-700/80">
              멤버의 기본 프로필과 DUPR 정보를 확인할 수 있어요.
            </p>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-amber-950">DUPR Rating</h3>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {duprItems.map((item) => (
              <Card
                key={item.label}
                className="rounded-2xl bg-[rgba(255,205,0,0.07)] px-3 py-3 shadow-sm ring-1 ring-amber-100/70"
              >
                <p className="text-xs text-amber-700/80">{item.label}</p>
                <p
                  className={`mt-1 font-semibold text-amber-950 ${item.valueClassName}`}
                >
                  {item.value}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemberProfile;
