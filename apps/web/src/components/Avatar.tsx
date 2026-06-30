import React from "react";
import { Avatar as HeroAvatar } from "@heroui/react";
import { IoPerson } from "react-icons/io5";

interface AvatarProps {
  avatarUrl?: string;
  name?: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const sizeClassMap: Record<NonNullable<AvatarProps["size"]>, string> = {
  xs: "h-6 w-6",
  sm: "h-12 w-12",
  md: "h-20 w-20",
  lg: "h-24 w-24",
};

const iconSizeMap: Record<NonNullable<AvatarProps["size"]>, string> = {
  xs: "text-sm",
  sm: "text-2xl",
  md: "text-4xl",
  lg: "text-5xl",
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
}) => {
  return (
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
};

export default Avatar;
