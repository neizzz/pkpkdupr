import { createHash, randomBytes, randomUUID } from "crypto";
import type { Player } from "@pkpkdupr/shared/player";
import { generateEntityId } from "@pkpkdupr/shared/entityId";
import type { AuthService } from "./AuthService";
import {
  type ExternalAuthProvider,
  type UserAuthProvider,
  isExternalUserAuthProvider,
} from "./authConfig";

const DB_SERVER_URL = process.env.DB_SERVER_URL || "http://localhost:5001";
const STATE_TTL_MS = 10 * 60 * 1000;
const HANDOFF_TTL_MS = 5 * 60 * 1000;

type DbRequestOptions = RequestInit & { retries?: number };

export interface KakaoAuthStart {
  state: string;
  redirectUrl: string;
}

export type KakaoAuthExchangeResult =
  | { status: "authenticated"; accessToken: string; isFirstLogin: boolean }
  | { status: "onboarding"; registrationTicket: string };

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

const createSecret = () => randomBytes(32).toString("base64url");

const normalizeKakaoError = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export class KakaoAuthService {
  private readonly provider: ExternalAuthProvider;
  private readonly restApiKey: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly webOrigin: string;
  private readonly mockSubject: string;

  constructor(
    provider: UserAuthProvider,
    private readonly accounts: AuthService,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    if (!isExternalUserAuthProvider(provider)) {
      throw new Error("KakaoAuthService는 외부 인증 provider가 필요합니다.");
    }
    this.provider = provider;
    this.restApiKey = process.env.KAKAO_REST_API_KEY?.trim() ?? "";
    this.clientSecret = process.env.KAKAO_CLIENT_SECRET?.trim() ?? "";
    this.redirectUri =
      process.env.KAKAO_REDIRECT_URI?.trim() ??
      "http://localhost:4001/auth/kakao/callback";
    this.webOrigin =
      process.env.KAKAO_WEB_ORIGIN?.trim() ?? "http://pkelo.localhost:8081";
    this.mockSubject =
      process.env.KAKAO_MOCK_SUBJECT?.trim() ?? "mock-kakao-user";
  }

  assertConfigured() {
    if (this.provider === "kakao" && (!this.restApiKey || !this.clientSecret)) {
      throw new Error(
        "Kakao 로그인에는 KAKAO_REST_API_KEY와 KAKAO_CLIENT_SECRET이 필요합니다.",
      );
    }
  }

  private async dbRequest<T>(path: string, init?: DbRequestOptions): Promise<T> {
    const res = await this.fetchImpl(`${DB_SERVER_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `DB 서버 요청 실패: ${res.status}`);
    }
    return (await res.json()) as T;
  }

  private callbackRedirect(ticket: string) {
    return `${this.webOrigin.replace(/\/+$/, "")}/login/kakao/callback#ticket=${encodeURIComponent(ticket)}`;
  }

  async start(): Promise<KakaoAuthStart> {
    this.assertConfigured();
    const state = createSecret();
    const now = new Date();
    await this.dbRequest("/internal/auth/oauth-transactions", {
      method: "POST",
      body: JSON.stringify({
        id: `oauth-transaction-${randomUUID()}`,
        provider: this.provider,
        stateHash: sha256(state),
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + STATE_TTL_MS).toISOString(),
      }),
    });

    if (this.provider === "kakao-mock") {
      return { state, redirectUrl: `/auth/kakao/callback?state=${encodeURIComponent(state)}&mock=1` };
    }

    const authorizationUrl = new URL("https://kauth.kakao.com/oauth/authorize");
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("client_id", this.restApiKey);
    authorizationUrl.searchParams.set("redirect_uri", this.redirectUri);
    authorizationUrl.searchParams.set("state", state);
    return { state, redirectUrl: authorizationUrl.toString() };
  }

  private async retrieveKakaoSubject(code: string): Promise<string> {
    const tokenResponse = await this.fetchImpl("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: this.restApiKey,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        code,
      }),
    });
    if (!tokenResponse.ok) {
      throw new Error("Kakao 토큰 교환에 실패했습니다.");
    }
    const token = (await tokenResponse.json()) as { access_token?: string };
    if (!token.access_token) throw new Error("Kakao access token이 없습니다.");

    const profileResponse = await this.fetchImpl("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!profileResponse.ok) {
      throw new Error("Kakao 사용자 정보를 조회하지 못했습니다.");
    }
    const profile = (await profileResponse.json()) as { id?: string | number };
    if (profile.id == null) throw new Error("Kakao 사용자 식별자가 없습니다.");
    return String(profile.id);
  }

  async handleCallback(input: { state?: string; code?: string; mock?: boolean }) {
    if (!input.state) throw new Error("Kakao state가 없습니다.");
    const providerSubject =
      this.provider === "kakao-mock" && input.mock
        ? this.mockSubject
        : input.code
          ? await this.retrieveKakaoSubject(input.code)
          : (() => {
              throw new Error("Kakao authorization code가 없습니다.");
            })();
    const ticket = createSecret();
    const now = new Date();
    await this.dbRequest("/internal/auth/oauth-transactions/callback", {
      method: "POST",
      body: JSON.stringify({
        stateHash: sha256(input.state),
        providerSubject,
        handoffHash: sha256(ticket),
        now: now.toISOString(),
        expiresAt: new Date(now.getTime() + HANDOFF_TTL_MS).toISOString(),
      }),
    });
    return this.callbackRedirect(ticket);
  }

  async exchange(ticket: string): Promise<KakaoAuthExchangeResult> {
    if (!ticket) throw new Error("로그인 ticket이 없습니다.");
    const registrationTicket = createSecret();
    const consumed = await this.dbRequest<{
      transaction: { provider: ExternalAuthProvider };
      playerId: string | null;
    }>("/internal/auth/oauth-transactions/handoff", {
      method: "POST",
      body: JSON.stringify({
        handoffHash: sha256(ticket),
        registrationHash: sha256(registrationTicket),
        now: new Date().toISOString(),
      }),
    });
    if (consumed.playerId) {
      return {
        status: "authenticated",
        ...(await this.accounts.issueExternalAccessToken(
          consumed.playerId,
          consumed.transaction.provider,
        )),
      };
    }
    return { status: "onboarding", registrationTicket };
  }

  async completeOnboarding(input: {
    registrationTicket: string;
    username: string;
    gender: "M" | "F";
  }) {
    try {
      return await this.accounts.registerExternalPlayer({
        ...input,
        registrationTicketHash: sha256(input.registrationTicket),
        provider: this.provider,
      });
    } catch (error) {
      throw new Error(normalizeKakaoError(error, "Kakao 가입을 완료하지 못했습니다."));
    }
  }
}
