import React from "react";
import Avatar from "@/components/Avatar";

interface AvatarGroupItem {
    id: string | number;
    avatarUrl?: string;
    name?: string;
}

interface AvatarGroupProps {
    items: AvatarGroupItem[];
    max?: number;
    size?: "xs" | "sm" | "md" | "lg";
    className?: string;
}

const spacingClassMap: Record<NonNullable<AvatarGroupProps["size"]>, string> = {
    xs: "-space-x-1",
    sm: "-space-x-2",
    md: "-space-x-3",
    lg: "-space-x-4",
};

const counterSizeClassMap: Record<NonNullable<AvatarGroupProps["size"]>, string> = {
    xs: "h-6 w-6 text-[10px]",
    sm: "h-12 w-12 text-sm",
    md: "h-18 w-18 text-base",
    lg: "h-24 w-24 text-lg",
};

const AvatarGroup: React.FC<AvatarGroupProps> = ({
    items,
    max = 5,
    size = "md",
    className,
}) => {
    const visible = items.slice(0, max);
    const overflow = items.length - visible.length;

    return (
        <div
            className={[
                "flex items-center",
                spacingClassMap[size],
                className,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            {visible.map((item) => (
                <Avatar
                    key={item.id}
                    avatarUrl={item.avatarUrl}
                    name={item.name}
                    size={size}
                    className="ring-2 ring-white"
                />
            ))}
            {overflow > 0 && (
                <div
                    className={[
                        "flex shrink-0 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-600 ring-2 ring-white",
                        counterSizeClassMap[size],
                    ].join(" ")}
                >
                    +{overflow}
                </div>
            )}
        </div>
    );
};

export default AvatarGroup;
