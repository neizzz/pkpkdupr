import React from "react";
import { Chip } from "@heroui/react";
import { IoArrowDown, IoArrowUp } from "react-icons/io5";

interface RatingDeltaChipProps {
  delta: number;
  hasData?: boolean;
}

const RatingDeltaChip: React.FC<RatingDeltaChipProps> = ({
  delta,
  hasData = true,
}) => {
  if (!hasData) {
    return (
      <Chip
        size="sm"
        variant="soft"
        color="default"
        className="h-6 px-1.5"
      >
        <span className="flex items-center gap-0.5 text-[11px] font-semibold tabular-nums text-slate-400">
          - 0.000
        </span>
      </Chip>
    );
  }

  const color =
    delta > 0 ? ("success" as const) : delta < 0 ? ("danger" as const) : ("default" as const);
  const Icon = delta > 0 ? IoArrowUp : delta < 0 ? IoArrowDown : null;

  return (
    <Chip size="sm" variant="soft" color={color} className="h-6 px-1.5">
      <span className="flex items-center gap-0.5 text-[11px] font-semibold tabular-nums">
        {Icon ? <Icon className="size-3" /> : null}
        {Math.abs(delta).toFixed(3)}
      </span>
    </Chip>
  );
};

export default RatingDeltaChip;
