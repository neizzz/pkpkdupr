import React from "react";
import { Avatar as HeroAvatar, Badge } from "@heroui/react";
import { IoPerson } from "react-icons/io5";

interface AvatarProps {
  avatarUrl?: string;
  name?: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  isMe?: boolean;
}

const sizeClassMap: Record<NonNullable<AvatarProps["size"]>, string> = {
  xs: "h-6 w-6",
  sm: "h-12 w-12",
  md: "h-18 w-18",
  lg: "h-24 w-24",
};

const iconSizeMap: Record<NonNullable<AvatarProps["size"]>, string> = {
  xs: "text-md",
  sm: "text-2xl",
  md: "text-3xl",
  lg: "text-4xl",
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
  isMe = false,
}) => {
  const avatar = (
    <HeroUiAvatar
      size={size}
      className={[
        "shrink-0 overflow-hidden rounded-full shadow-inner",
        sizeClassMap[size],
        className,
      ].join(" ")}
    >
      {avatarUrl ? (
        <HeroUiAvatar.Image
          src={avatarUrl}
          alt={name ?? "avatar"}
          className="rounded-full object-cover"
        />
      ) : null}
      <HeroUiAvatar.Fallback className="flex items-center justify-center rounded-full bg-gray-100 text-amber-600 shadow-inner">
        <IoPerson className={iconSizeMap[size]} />
      </HeroUiAvatar.Fallback>
    </HeroUiAvatar>
  );

  if (!isMe || size === "xs") {
    return avatar;
  }

  return (
    <Badge.Anchor>
      {avatar}
      <Badge
        color="accent"
        size={size === "sm" ? "sm" : "md"}
        placement="top-left"
        className={[
          "rounded-full py-0 border-2 border-white",
          size === "sm" ? "px-0.5" : "px-1.5",
          size === "sm" ? "py-0.5" : "py-0",
        ].join(" ")}
      >
        <Badge.Label className="text-6 font-semibold leading-none">
          ME
        </Badge.Label>
      </Badge>
    </Badge.Anchor>
  );
};

export default Avatar;
