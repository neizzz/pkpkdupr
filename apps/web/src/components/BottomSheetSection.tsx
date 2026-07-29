import React from "react";

interface BottomSheetSectionProps {
  children: React.ReactNode;
  className?: string;
}

const BottomSheetSection: React.FC<BottomSheetSectionProps> = ({
  children,
  className,
}) => (
  <section
    className={[
      "flex flex-col gap-2 rounded-3xl bg-slate-50/80 p-4",
      className,
    ]
      .filter(Boolean)
      .join(" ")}
  >
    {children}
  </section>
);

export default BottomSheetSection;
