import React from "react";
import { IoChevronForward } from "react-icons/io5";
import Avatar from "@/components/Avatar";

interface ProfileIdentityLabelProps {
  avatarUrl?: string;
  name?: string;
  label?: string;
  showChevron?: boolean;
  chevronClassName?: string;
  className?: string;
}

const ProfileIdentityLabel: React.FC<ProfileIdentityLabelProps> = ({
  avatarUrl,
  name,
  label,
  showChevron = false,
  chevronClassName,
  className,
}) => {
  const displayLabel = label ?? name ?? "프로필";

  return (
    <span
      className={[
        "flex h-9 min-w-0 items-center gap-1.5 text-sm font-semibold",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Avatar size="xs" avatarUrl={avatarUrl} name={name} />
      <span className="truncate">{displayLabel}</span>
      {showChevron ? (
        <IoChevronForward
          aria-hidden="true"
          className={[
            "-mr-1.5 size-4 shrink-0",
            chevronClassName,
          ]
            .filter(Boolean)
            .join(" ")}
        />
      ) : null}
    </span>
  );
};

export default ProfileIdentityLabel;
