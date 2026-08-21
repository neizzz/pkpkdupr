import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import PrivacyPolicyContent from "@/components/PrivacyPolicyContent";

const PrivacyPolicy: React.FC = () => {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [scrollIndicator, setScrollIndicator] = useState({
    isVisible: false,
    thumbHeight: 100,
    thumbTop: 0,
  });

  const updateScrollIndicator = useCallback(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    const maxScrollTop = scrollArea.scrollHeight - scrollArea.clientHeight;
    if (maxScrollTop <= 0) {
      setScrollIndicator({ isVisible: false, thumbHeight: 100, thumbTop: 0 });
      return;
    }

    const thumbHeight = Math.max(
      12,
      (scrollArea.clientHeight / scrollArea.scrollHeight) * 100,
    );
    const progress = scrollArea.scrollTop / maxScrollTop;
    setScrollIndicator({
      isVisible: true,
      thumbHeight,
      thumbTop: progress * (100 - thumbHeight),
    });
  }, []);

  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    const resizeObserver = new ResizeObserver(updateScrollIndicator);
    resizeObserver.observe(scrollArea);
    scrollArea.addEventListener("scroll", updateScrollIndicator, {
      passive: true,
    });
    window.addEventListener("resize", updateScrollIndicator);
    updateScrollIndicator();

    return () => {
      resizeObserver.disconnect();
      scrollArea.removeEventListener("scroll", updateScrollIndicator);
      window.removeEventListener("resize", updateScrollIndicator);
    };
  }, [updateScrollIndicator]);

  return (
    <div className="relative h-full bg-white text-pkpk-main-font">
      <div ref={scrollAreaRef} className="h-full overflow-y-auto">
        <header className="sticky top-0 z-10 border-b border-border bg-white/95 px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-4 backdrop-blur">
          <div className="mx-auto flex w-full max-w-[480px] items-center justify-between gap-4">
            <h1 className="text-lg font-bold">개인정보 처리방침</h1>
            <Link
              to="/login"
              className="text-sm font-semibold text-pkpk-primary-bg underline underline-offset-4"
            >
              로그인으로
            </Link>
          </div>
        </header>

        <article className="mx-auto w-full max-w-[480px] px-4 pt-6 pb-[calc(var(--safe-bottom)+2rem)]">
          <PrivacyPolicyContent />
        </article>
      </div>

      {scrollIndicator.isVisible ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-1 top-3 bottom-3 z-20 w-1 rounded-full bg-pkpk-sub-font/15"
        >
          <span
            className="absolute inset-x-0 rounded-full bg-pkpk-primary-bg/60 transition-[top,height] duration-150"
            style={{
              height: `${scrollIndicator.thumbHeight}%`,
              top: `${scrollIndicator.thumbTop}%`,
            }}
          />
        </div>
      ) : null}
    </div>
  );
};

export default PrivacyPolicy;
