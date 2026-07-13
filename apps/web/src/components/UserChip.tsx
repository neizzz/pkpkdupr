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
  size?: "default" | "match";
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
  size = "default",
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
  const isMatchSize = size === "match";
  const chipWidthClass = isMatchSize
    ? "w-[clamp(6rem,32vw,10rem)]"
    : "w-[clamp(4.5rem,23vw,7.5rem)]";
  const reservedChipGridClass = isMatchSize
    ? "grid-cols-[minmax(0,clamp(6rem,32vw,10rem))_auto]"
    : "grid-cols-[minmax(0,clamp(4.5rem,23vw,7.5rem))_auto]";

  return (
    <div
      className={
        shouldReserveRemoveSlot
          ? `grid min-w-0 max-w-full ${reservedChipGridClass} items-center gap-1`
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
        className={`relative ${isMatchSize ? "h-8" : "h-6"} min-w-0 max-w-full overflow-hidden rounded-full px-0 transition-colors ${shouldReserveRemoveSlot ? "w-full pr-2" : `${chipWidthClass} pr-3`} ${isSelected ? "ring-2 ring-[#409eff] ring-offset-2" : ""} ${isPressable ? (isDisabled ? "cursor-not-allowed opacity-35" : "cursor-pointer opacity-100") : "cursor-default opacity-100"} shadow-none ${genderBgClass}`}
      >
        <div className="flex min-w-0 max-w-full items-center gap-1">
          <Avatar
            size="xs"
            avatarUrl={player.avatarUrl}
            name={player.username}
            className={`bg-white/80 ${genderAvatarClass} ${
              isMatchSize ? "h-8 w-8" : ""
            }`}
            isMe={isMe}
          />
          <span
            className={`min-w-0 truncate ${
              isMatchSize
                ? "text-[clamp(0.875rem,3.5vw,1rem)]"
                : "text-[clamp(0.75rem,3vw,0.875rem)]"
            } text-current ${
              isMe ? "font-bold" : "font-medium"
            }`}
          >
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
