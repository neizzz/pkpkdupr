import React, { useEffect, useMemo, useState } from "react";
import QrCode from "react-qr-code";
import type {
  DevPlayerQrToken,
  DevPlayerQrTokenListResponse,
} from "@pkpkdupr/shared/qr";

const getGenderLabel = (gender: DevPlayerQrToken["player"]["gender"]) =>
  gender === "M" ? "남자" : "여자";

const getGenderClassName = (gender: DevPlayerQrToken["player"]["gender"]) =>
  gender === "M"
    ? "bg-[#409eff]/10 text-[#409eff]"
    : "bg-[#f8626c]/10 text-[#f8626c]";

const DevQrCard: React.FC<{ token: DevPlayerQrToken }> = ({ token }) => (
  <div className="rounded-3xl border border-amber-100 bg-white p-3 shadow-sm">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-amber-950">
          {token.player.username}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-amber-700/60">
          {token.player.id}
        </p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${getGenderClassName(
          token.player.gender,
        )}`}
      >
        {getGenderLabel(token.player.gender)}
      </span>
    </div>

    <div className="mt-3 flex justify-center rounded-2xl bg-white p-3 ring-1 ring-amber-100">
      <QrCode
        value={token.payload}
        size={132}
        bgColor="#ffffff"
        fgColor="#a16207"
      />
    </div>
  </div>
);

const DevQrSection: React.FC<{
  title: string;
  tokens: DevPlayerQrToken[];
}> = ({ title, tokens }) => (
  <section>
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-base font-bold text-amber-950">{title}</h2>
      <span className="text-xs font-semibold text-amber-700/70">
        {tokens.length}명
      </span>
    </div>
    <div className="grid grid-cols-2 gap-12 md:grid-cols-4 xl:gap-16">
      {tokens.map((token) => (
        <DevQrCard key={token.player.id} token={token} />
      ))}
    </div>
  </section>
);

const DevQrs: React.FC = () => {
  const [tokens, setTokens] = useState<DevPlayerQrToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const loadDevQrTokens = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const res = await fetch("/api/dev/player-qr-tokens");
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(
            errorData.error || "Dev QR 목록을 불러오지 못했습니다.",
          );
        }

        const data = (await res.json()) as DevPlayerQrTokenListResponse;
        if (!isCancelled) {
          setTokens(data.players);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Dev QR 목록을 불러오지 못했습니다.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadDevQrTokens();

    return () => {
      isCancelled = true;
    };
  }, []);

  const menTokens = useMemo(
    () => tokens.filter((token) => token.player.gender === "M").slice(0, 4),
    [tokens],
  );
  const womenTokens = useMemo(
    () => tokens.filter((token) => token.player.gender === "F").slice(0, 4),
    [tokens],
  );

  if (!import.meta.env.DEV) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-amber-50 px-6 text-center">
        <p className="text-sm font-semibold text-amber-800">
          Dev QR 페이지는 개발 환경에서만 사용할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-amber-50 px-4 py-6">
      <div className="mx-auto w-full max-w-7xl">
        <header>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-500">
            Dev Only
          </p>
          <h1 className="mt-1 text-2xl font-bold text-amber-950">
            Permanent Player QR
          </h1>
          <p className="mt-2 text-sm text-amber-700/80">
            매치 멤버 추가 테스트용 영구 QR입니다.
          </p>
        </header>

        {isLoading ? (
          <div className="mt-8 rounded-3xl bg-white p-6 text-center text-sm text-amber-700/70 shadow-sm">
            Dev QR 목록을 불러오는 중입니다...
          </div>
        ) : error ? (
          <div className="mt-8 rounded-3xl bg-white p-6 text-center text-sm font-semibold text-red-500 shadow-sm">
            {error}
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-8">
            <DevQrSection title="남자" tokens={menTokens} />
            <DevQrSection title="여자" tokens={womenTokens} />
          </div>
        )}
      </div>
    </div>
  );
};

export default DevQrs;
