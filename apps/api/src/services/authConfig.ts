export type UserAuthProvider = "password" | "kakao" | "kakao-mock";
export type ExternalAuthProvider = Exclude<UserAuthProvider, "password">;

const validProviders = new Set<UserAuthProvider>([
  "password",
  "kakao",
  "kakao-mock",
]);

export const resolveUserAuthProvider = (): UserAuthProvider => {
  const value = (process.env.USER_AUTH_PROVIDER ?? "password").trim();
  if (!validProviders.has(value as UserAuthProvider)) {
    throw new Error(
      "USER_AUTH_PROVIDER는 password, kakao, kakao-mock 중 하나여야 합니다.",
    );
  }
  if (value === "kakao-mock" && process.env.NODE_ENV === "production") {
    throw new Error("kakao-mock은 production에서 사용할 수 없습니다.");
  }
  return value as UserAuthProvider;
};

export const isExternalUserAuthProvider = (
  provider: UserAuthProvider,
): provider is ExternalAuthProvider => provider !== "password";
