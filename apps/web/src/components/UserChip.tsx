import React from "react";
import { Chip } from "@heroui/react";
import type { Player } from "@pkpkdupr/shared/player";
import { IoClose } from "react-icons/io5";
import Avatar from "@/components/Avatar";

interface UserChipProps {
  player: Pick<Player, "username" | "avatarUrl" | "gender">;
  onRemove?: () => void;
  removeLabel?: string;
  isMe?: boolean;
  endAdornment?: React.ReactNode;
}

const UserChip: React.FC<UserChipProps> = ({
  player,
  onRemove,
  removeLabel,
  isMe = false,
  endAdornment,
}) => {
  const genderBgClass =
    player.gender === "M"
      ? "bg-[#409eff]/10 text-[#409eff]"
      : "bg-[#f8626c]/10 text-[#f8626c]";
  const genderAvatarClass =
    player.gender === "M"
      ? "border-1 border-[#409eff]/15 shadow-[0_0_0_1px_rgba(64,158,255,0.16)]"
      : "border-1 border-[#f8626c]/15 shadow-[0_0_0_1px_rgba(248,98,108,0.16)]";

  return (
    <Chip
      variant="secondary"
      className={`relative h-6 w-30 overflow-hidden rounded-full px-0 ${onRemove ? "pr-1" : "pr-3"} shadow-none ${genderBgClass}`}
    >
      <div className="flex min-w-0 max-w-full items-center gap-1">
        <Avatar
          size="xs"
          avatarUrl={player.avatarUrl}
          name={player.username}
          className={`bg-white/80 ${genderAvatarClass}`}
          isMe={isMe}
        />
        <span className="min-w-0 truncate text-sm font-medium text-current">
          {player.username}
        </span>
        {endAdornment ? (
          <span className="absolute right-[6px] shrink-0 leading-none">
            {endAdornment}
          </span>
        ) : null}
        {onRemove ? (
          <button
            type="button"
            aria-label={removeLabel ?? `${player.username} 제거`}
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
            className="ml-0.5 shrink-0 rounded-full p-0.5 text-current/70 transition-colors hover:bg-white/70 hover:text-current"
          >
            <IoClose className="size-3.5" />
          </button>
        ) : null}
      </div>
    </Chip>
  );
};

export default UserChip;
