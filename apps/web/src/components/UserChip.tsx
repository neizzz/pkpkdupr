import React from "react";
import { Badge, Chip } from "@heroui/react";
import type { Player } from "@pkpkdupr/shared/player";
import { IoClose } from "react-icons/io5";
import Avatar from "@/components/Avatar";

interface UserChipProps {
  player: Pick<Player, "username" | "avatarUrl" | "gender">;
  onRemove?: () => void;
  removeLabel?: string;
  isMe?: boolean;
  isMeBadgeOffsetX?: number;
  size?: "default" | "match";
  chipWidthClass?: string;
  isMirrored?: boolean;
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
  isMeBadgeOffsetX,
  size = "default",
  chipWidthClass,
  isMirrored = false,
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
  const resolvedIsMeBadgeOffsetX =
    isMeBadgeOffsetX ?? (isMatchSize ? 10.5 : 40);
  const resolvedIsMeBadgeOffsetY = isMatchSize ? 10.5 : 20.5;
  const isMeBadgeScale = isMatchSize ? 1.2 : 1;
  const resolvedChipWidthClass =
    chipWidthClass ??
    (isMatchSize
      ? "w-[clamp(6rem,32cqw,10rem)]"
      : "w-[clamp(4.5rem,23vw,7.5rem)]");
  const reservedChipGridClass = isMatchSize
    ? "grid-cols-[minmax(0,clamp(6rem,32cqw,10rem))_auto]"
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
        className={`relative ${isMatchSize ? "h-[clamp(2rem,10cqw,2.75rem)]" : "h-6"} min-w-0 max-w-full ${isMe ? "overflow-visible" : "overflow-hidden"} rounded-full px-0 transition-colors ${shouldReserveRemoveSlot ? `w-full ${isMirrored ? "pl-2" : "pr-2"}` : `${resolvedChipWidthClass} ${isMirrored ? "pl-3" : "pr-3"}`} ${isSelected ? "ring-2 ring-[#409eff] ring-offset-2" : ""} ${isPressable ? (isDisabled ? "cursor-not-allowed opacity-35" : "cursor-pointer opacity-100") : "cursor-default opacity-100"} shadow-none ${genderBgClass}`}
      >
        <div
          className={`flex w-full min-w-0 max-w-full items-center gap-1 ${
            isMirrored ? "flex-row-reverse" : ""
          }`}
        >
          <Badge.Anchor className="shrink-0">
            <Avatar
              size="xs"
              avatarUrl={player.avatarUrl}
              name={player.username}
              fallbackIconClassName={
                isMatchSize
                  ? "text-[clamp(1.25rem,6cqw,1.375rem)]"
                  : undefined
              }
              className={`bg-white/80 ${genderAvatarClass} ${
                isMatchSize
                  ? "h-[clamp(2rem,10cqw,2.75rem)] w-[clamp(2rem,10cqw,2.75rem)]"
                  : ""
              }`}
            />
            {isMe ? (
              <Badge
                variant="primary"
                size="sm"
                placement={isMirrored ? "top-right" : "top-left"}
                className="pointer-events-none z-10 !bg-pkpk-secondary-bg !text-pkpk-secondary-font !leading-none shadow-sm"
                style={{
                  transform: isMirrored
                    ? `translate(${resolvedIsMeBadgeOffsetX}%, -${resolvedIsMeBadgeOffsetY}%) scale(${isMeBadgeScale})`
                    : `translate(-${resolvedIsMeBadgeOffsetX}%, -${resolvedIsMeBadgeOffsetY}%) scale(${isMeBadgeScale})`,
                }}
              >
                <span className="relative top-px block">나</span>
              </Badge>
            ) : null}
          </Badge.Anchor>
          <span
            className={`min-w-0 truncate ${
              isMatchSize
                ? "text-[clamp(0.875rem,3.5cqw,1.125rem)]"
                : "text-[clamp(0.75rem,3vw,0.875rem)]"
            } text-current ${isMe ? "font-bold" : "font-medium"} ${
              isMirrored ? "text-right" : ""
            }`}
          >
            {player.username}
          </span>
          {endAdornment ? (
            <span
              className={`absolute ${isMirrored ? "left-[6px]" : "right-[6px]"} shrink-0 leading-none`}
            >
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
          className="shrink-0 rounded-full pl-0.5 text-current/70 transition-colors hover:bg-white/70 hover:text-current"
        >
          <IoClose className="size-3.5" />
        </button>
      ) : reserveRemoveSlot ? (
        <span
          aria-hidden="true"
          className="invisible shrink-0 rounded-full pl-0.5 text-current/70"
        >
          <IoClose className="size-3.5" />
        </span>
      ) : null}
    </div>
  );
};

export default UserChip;
