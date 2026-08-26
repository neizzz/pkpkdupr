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
  { status: "authenticated"; session: Awaited<ReturnType<AuthService["issueExternalDeviceSession"]>> };

type VerifiedKakaoProfile = {
  providerSubject: string;
  legalName?: string;
  legalGender?: "M" | "F";
  legalBirthDate?: string;
};

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

const createSecret = () => randomBytes(32).toString("base64url");

const getFullAge = (birthDate: string, today = new Date()) => {
  const [year, month, day] = birthDate.split("-").map(Number);
  let age = today.getFullYear() - year;
  if (
    today.getMonth() + 1 < month ||
    (today.getMonth() + 1 === month && today.getDate() < day)
  ) {
    age -= 1;
  }
  return age;
};

const normalizeKakaoError = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const normalizeKakaoExchangeError = (error: unknown) => {
  const message = normalizeKakaoError(error, "Kakao 로그인 처리가 실패했습니다.");
  if (message.includes("OAUTH_VERIFIED_PROFILE_REQUIRED")) {
    return "카카오 본인확인정보(법정 실명·성별·생년월일)를 받지 못했습니다. 카카오 제휴 승인과 동의항목 설정을 확인해주세요.";
  }
  if (
    message.includes("OAUTH_HANDOFF_NOT_FOUND") ||
    message.includes("OAUTH_HANDOFF_INVALID")
  ) {
    return "카카오 로그인 정보가 만료되었거나 이미 사용되었습니다. 다시 로그인해주세요.";
  }
  if (message.includes("OAUTH_REGISTRATION_INVALID")) {
    return "카카오 가입 정보를 확인하지 못했습니다. 다시 로그인해주세요.";
  }
  return message;
};

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
      "http://localhost:8443/auth/kakao/callback";
    this.webOrigin =
      process.env.KAKAO_WEB_ORIGIN?.trim() ?? "http://localhost:8443";
    this.mockSubject =
      process.env.KAKAO_MOCK_SUBJECT?.trim() ?? "mock-kakao-user";
  }

  assertConfigured() {
    if (this.provider === "kakao" && (!this.restApiKey || !this.clientSecret)) {
      throw new Error(
        "Kakao 로그인에는 KAKAO_REST_API_KEY와 KAKAO_CLIENT_SECRET이 필요합니다.",
      );
    }
    if (
      this.provider === "kakao" &&
      process.env.KAKAO_CONFIDENTIAL_USER_INFO_APPROVED !== "true"
    ) {
      throw new Error(
        "카카오 본인확인정보 제휴 승인 후 KAKAO_CONFIDENTIAL_USER_INFO_APPROVED=true를 설정해주세요.",
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

  async start(input: { persistentSessionRequested?: boolean } = {}): Promise<KakaoAuthStart> {
    this.assertConfigured();
    const state = createSecret();
    const now = new Date();
    await this.dbRequest("/internal/auth/oauth-transactions", {
      method: "POST",
      body: JSON.stringify({
        id: `oauth-transaction-${randomUUID()}`,
        provider: this.provider,
        stateHash: sha256(state),
        persistentSessionRequested: input.persistentSessionRequested === true,
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

  private async retrieveKakaoProfile(code: string): Promise<VerifiedKakaoProfile> {
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
    const profile = (await profileResponse.json()) as {
      id?: string | number;
      kakao_account?: {
        legal_name?: string;
        legal_gender?: "male" | "female";
        legal_birth_date?: string;
      };
    };
    if (profile.id == null) throw new Error("Kakao 사용자 식별자가 없습니다.");
    const legalName = profile.kakao_account?.legal_name?.trim();
    const legalGender = profile.kakao_account?.legal_gender;
    const rawBirthDate = profile.kakao_account?.legal_birth_date;
    const legalBirthDate = rawBirthDate?.match(/^(\d{4})(\d{2})(\d{2})$/)
      ? `${rawBirthDate.slice(0, 4)}-${rawBirthDate.slice(4, 6)}-${rawBirthDate.slice(6, 8)}`
      : undefined;
    if (legalBirthDate && getFullAge(legalBirthDate) < 14) {
      throw new Error("PKELO는 만 14세 이상만 가입하고 경기 참여할 수 있습니다.");
    }
    return {
      providerSubject: String(profile.id),
      legalName,
      legalGender:
        legalGender === "male" ? "M" : legalGender === "female" ? "F" : undefined,
      legalBirthDate,
    };
  }

  async handleCallback(input: { state?: string; code?: string; mock?: boolean }) {
    if (!input.state) throw new Error("Kakao state가 없습니다.");
    const profile =
      this.provider === "kakao-mock" && input.mock
        ? {
            providerSubject: this.mockSubject,
            legalName: "카카오 테스트 사용자",
            legalGender: "M" as const,
            legalBirthDate: "1990-01-01",
          }
        : input.code
          ? await this.retrieveKakaoProfile(input.code)
          : (() => {
              throw new Error("Kakao authorization code가 없습니다.");
            })();
    const ticket = createSecret();
    const now = new Date();
    await this.dbRequest("/internal/auth/oauth-transactions/callback", {
      method: "POST",
      body: JSON.stringify({
        stateHash: sha256(input.state),
        ...profile,
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
    let consumed: {
      transaction: {
        provider: ExternalAuthProvider;
        persistentSessionRequested: boolean;
        legalName: string | null;
        legalGender: "M" | "F" | null;
        legalBirthDate: string | null;
      };
      playerId: string | null;
    };
    try {
      consumed = await this.dbRequest("/internal/auth/oauth-transactions/handoff", {
        method: "POST",
        body: JSON.stringify({
          handoffHash: sha256(ticket),
          registrationHash: sha256(registrationTicket),
          now: new Date().toISOString(),
        }),
      });
    } catch (error) {
      throw new Error(normalizeKakaoExchangeError(error));
    }
    if (consumed.playerId) {
      return {
        status: "authenticated",
        session: await this.accounts.issueExternalDeviceSession(
          consumed.playerId, consumed.transaction.provider,
          consumed.transaction.persistentSessionRequested === true,
        ),
      };
    }
    if (
      !consumed.transaction.legalName ||
      !consumed.transaction.legalGender ||
      !consumed.transaction.legalBirthDate
    ) {
      throw new Error("카카오 본인확인정보(법정 실명·성별·생년월일)가 필요합니다.");
    }
    try {
      const session = await this.accounts.registerExternalPlayer({
        registrationTicketHash: sha256(registrationTicket),
        username: consumed.transaction.legalName,
        gender: consumed.transaction.legalGender,
        birthDate: consumed.transaction.legalBirthDate,
        provider: consumed.transaction.provider,
      });
      return { status: "authenticated", session };
    } catch (error) {
      throw new Error(normalizeKakaoError(error, "Kakao 가입을 완료하지 못했습니다."));
    }
  }
}
