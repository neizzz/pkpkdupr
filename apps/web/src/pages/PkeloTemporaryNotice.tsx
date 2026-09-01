import React from "react";
import { Spinner } from "@heroui/react";
import PkeloLoginLayout from "@/pages/PkeloLoginLayout";

type PkeloTemporaryNoticeProps = {
  title: string;
  message: string;
};

const PkeloTemporaryNotice: React.FC<PkeloTemporaryNoticeProps> = ({
  title,
  message,
}) => (
  <PkeloLoginLayout>
    <section className="text-center text-white" aria-live="polite">
      <h2 className="text-[1.2rem] font-extrabold tracking-tight">{title}</h2>
      <p className="mt-4 whitespace-pre-wrap text-xl font-bold leading-8 text-white">
        {message}
      </p>
    </section>
  </PkeloLoginLayout>
);

export const PkeloNoticeLoading: React.FC = () => (
  <PkeloLoginLayout>
    <div
      className="flex h-[109px] items-center justify-center"
      role="status"
    >
      <Spinner
        aria-label="안내 확인 중"
        color="current"
        className="text-white"
      />
    </div>
  </PkeloLoginLayout>
);

export default PkeloTemporaryNotice;
