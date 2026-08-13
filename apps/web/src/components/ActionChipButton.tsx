import React from "react";

interface ActionChipButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  children: React.ReactNode;
}

const ActionChipButton: React.FC<ActionChipButtonProps> = ({
  children,
  className,
  ...props
}) => (
  <button
    {...props}
    type="button"
    className={[
      "flex shrink-0 items-center gap-1 rounded-full bg-[#409eff] px-4 py-2 text-sm font-medium text-white disabled:bg-slate-200 disabled:text-slate-400",
      className,
    ]
      .filter(Boolean)
      .join(" ")}
  >
    {children}
  </button>
);

export default ActionChipButton;
