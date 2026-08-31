const FORM_DRAFT_PREFIX = "pkelo:form-draft";
const FORM_DRAFT_VERSION = 1;
const FORM_DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type FormDraftKind =
  | "match-create"
  | "club-create"
  | "club-announcement-create"
  | "club-session-create";

type StoredFormDraft<T> = {
  version: number;
  savedAt: number;
  value: T;
};

export const getFormDraftKey = (
  kind: FormDraftKind,
  playerId: string,
  contextId = "global",
) => `${FORM_DRAFT_PREFIX}:v${FORM_DRAFT_VERSION}:${kind}:${playerId}:${contextId}`;

export const readFormDraft = <T,>(key: string): T | null => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredFormDraft<T>>;
    if (
      parsed.version !== FORM_DRAFT_VERSION ||
      typeof parsed.savedAt !== "number" ||
      !Object.prototype.hasOwnProperty.call(parsed, "value") ||
      Date.now() - parsed.savedAt > FORM_DRAFT_TTL_MS
    ) {
      window.localStorage.removeItem(key);
      return null;
    }

    return parsed.value as T;
  } catch {
    return null;
  }
};

export const writeFormDraft = <T,>(key: string, value: T) => {
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        version: FORM_DRAFT_VERSION,
        savedAt: Date.now(),
        value,
      } satisfies StoredFormDraft<T>),
    );
  } catch {
    // localStorage가 비활성화되었거나 가득 차도 폼 입력은 계속 가능해야 한다.
  }
};

export const removeFormDraft = (key: string) => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage 접근 오류는 폼 동작을 막지 않는다.
  }
};
