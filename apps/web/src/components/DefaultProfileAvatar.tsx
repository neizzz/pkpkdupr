import React from "react";
import { IoPerson } from "react-icons/io5";

interface DefaultProfileAvatarProps {
  size?: "sm" | "md" | "lg";
}

const sizeClassMap: Record<NonNullable<DefaultProfileAvatarProps["size"]>, string> =
  {
    sm: "h-12 w-12",
    md: "h-20 w-20",
    lg: "h-24 w-24",
  };

const iconSizeMap: Record<NonNullable<DefaultProfileAvatarProps["size"]>, string> =
  {
    sm: "text-2xl",
    md: "text-4xl",
    lg: "text-5xl",
  };

const DefaultProfileAvatar: React.FC<DefaultProfileAvatarProps> = ({
  size = "md",
}) => {
  return (
    <div
      className={[
        "flex shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 shadow-inner",
        sizeClassMap[size],
      ].join(" ")}
      aria-hidden="true"
    >
      <IoPerson className={iconSizeMap[size]} />
    </div>
  );
};

export default DefaultProfileAvatar;
