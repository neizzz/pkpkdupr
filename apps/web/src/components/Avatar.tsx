import React from "react";
import { Avatar as HeroAvatar } from "@heroui/react";
import { IoPerson } from "react-icons/io5";
import { MdOutlineCreate } from "react-icons/md";
import { resolveAssetUrl } from "@/lib/api";

interface AvatarProps {
  avatarUrl?: string;
  name?: string;
  size?: "xs" | "session" | "sm" | "md" | "lg";
  className?: string;
  onEditClick?: () => void;
}

const sizeClassMap: Record<NonNullable<AvatarProps["size"]>, string> = {
  xs: "h-6 w-6",
  session: "h-9 w-9",
  sm: "h-12 w-12",
  md: "h-18 w-18",
  lg: "h-24 w-24",
};

const iconSizeMap: Record<NonNullable<AvatarProps["size"]>, string> = {
  xs: "text-md",
  session: "text-xl",
  sm: "text-2xl",
  md: "text-3xl",
  lg: "text-4xl",
};

const editBadgeSizeMap: Record<NonNullable<AvatarProps["size"]>, string> = {
  xs: "size-3",
  session: "size-4",
  sm: "size-4",
  md: "size-5",
  lg: "size-6",
};

const HeroUiAvatar = HeroAvatar as React.ComponentType<any> & {
  Image: React.ComponentType<any>;
  Fallback: React.ComponentType<any>;
};

const Avatar: React.FC<AvatarProps> = ({
  avatarUrl,
  name,
  size = "md",
  className,
  onEditClick,
}) => {
  const resolvedAvatarUrl = resolveAssetUrl(avatarUrl);

  const avatar = (
    <HeroUiAvatar
      size={size}
      className={[
        "shrink-0 overflow-hidden rounded-full shadow-inner",
        sizeClassMap[size],
        className,
      ].join(" ")}
    >
      {resolvedAvatarUrl ? (
        <HeroUiAvatar.Image
          src={resolvedAvatarUrl}
          alt={name ?? "avatar"}
          className="rounded-full object-cover"
        />
      ) : null}
      <HeroUiAvatar.Fallback className="flex items-center justify-center rounded-full bg-gray-100 text-pkpk-sub-bg shadow-inner">
        <IoPerson className={iconSizeMap[size]} />
      </HeroUiAvatar.Fallback>
    </HeroUiAvatar>
  );

  if (!onEditClick) {
    return avatar;
  }

  return (
    <div className="relative inline-block shrink-0">
      {avatar}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onEditClick();
        }}
        className={`absolute bottom-0 right-0 flex ${editBadgeSizeMap[size]} items-center justify-center rounded-full bg-white text-black shadow-sm ring-1 ring-border`}
        aria-label="프로필 이미지 변경"
      >
        <MdOutlineCreate className="size-[60%]" />
      </button>
    </div>
  );
};

export default Avatar;
