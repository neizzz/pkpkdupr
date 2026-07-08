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
  reserveRemoveSlot?: boolean;
  onPress?: () => void;
  isPressable?: boolean;
  isSelected?: boolean;
  isDisabled?: boolean;
}

const UserChip: React.FC<UserChipProps> = ({
  player,
  onRemove,
  removeLabel,
  isMe = false,
  endAdornment,
  reserveRemoveSlot = false,
  onPress,
  isPressable = false,
  isSelected = false,
  isDisabled = false,
}) => {
  const genderBgClass =
    player.gender === "M"
      ? "bg-[#409eff]/10 text-[#409eff]"
      : "bg-[#f8626c]/10 text-[#f8626c]";
  const genderAvatarClass =
    player.gender === "M"
      ? "border-1 border-[#409eff]/15 shadow-[0_0_0_1px_rgba(64,158,255,0.16)]"
      : "border-1 border-[#f8626c]/15 shadow-[0_0_0_1px_rgba(248,98,108,0.16)]";
  const shouldReserveRemoveSlot = !!onRemove || reserveRemoveSlot;
  const canPress = isPressable && !isDisabled && !!onPress;

  return (
    <div
      className={
        shouldReserveRemoveSlot
          ? "grid min-w-0 max-w-full grid-cols-[minmax(0,7.5rem)_auto] items-center gap-1"
          : "flex min-w-0 max-w-full items-center gap-1"
      }
    >
      <Chip
        variant="secondary"
        role={isPressable ? "button" : undefined}
        tabIndex={isPressable ? 0 : undefined}
        onClick={canPress ? onPress : undefined}
        onKeyDown={
          canPress
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onPress();
                }
              }
            : undefined
        }
        className={`relative h-6 min-w-0 max-w-full overflow-hidden rounded-full px-0 transition ${shouldReserveRemoveSlot ? "w-full pr-2" : "w-30 pr-3"} ${isSelected ? "ring-2 ring-[#409eff] ring-offset-2" : ""} ${isPressable ? (isDisabled ? "cursor-not-allowed opacity-35" : "cursor-pointer opacity-100") : "cursor-default opacity-100"} shadow-none ${genderBgClass}`}
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
        </div>
      </Chip>
      {onRemove ? (
        <button
          type="button"
          aria-label={removeLabel ?? `${player.username} 제거`}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          className="shrink-0 rounded-full p-0.5 text-current/70 transition-colors hover:bg-white/70 hover:text-current"
        >
          <IoClose className="size-3.5" />
        </button>
      ) : reserveRemoveSlot ? (
        <span
          aria-hidden="true"
          className="invisible shrink-0 rounded-full p-0.5 text-current/70"
        >
          <IoClose className="size-3.5" />
        </span>
      ) : null}
    </div>
  );
};

export default UserChip;
