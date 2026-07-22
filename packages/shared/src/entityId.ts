export const entityIdPrefixes = {
  match: "M",
  session: "S",
  player: "P",
} as const;

export type EntityIdKind = keyof typeof entityIdPrefixes;

const ENTITY_ID_SUFFIX_LENGTH = 7;
const ENTITY_ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const ENTITY_ID_BYTE_LIMIT =
  Math.floor(256 / ENTITY_ID_ALPHABET.length) * ENTITY_ID_ALPHABET.length;

type CryptoSource = {
  getRandomValues<T extends ArrayBufferView | null>(array: T): T;
};

const getCryptoSource = (): CryptoSource => {
  const source = (globalThis as typeof globalThis & {
    crypto?: CryptoSource;
  }).crypto;

  if (!source?.getRandomValues) {
    throw new Error("보안 난수 생성기를 사용할 수 없습니다.");
  }

  return source;
};

export const isEntityId = (value: unknown, kind: EntityIdKind): value is string =>
  typeof value === "string" &&
  new RegExp(`^${entityIdPrefixes[kind]}[a-z0-9]{${ENTITY_ID_SUFFIX_LENGTH}}$`).test(
    value,
  );

export const generateEntityId = (
  kind: EntityIdKind,
  cryptoSource: CryptoSource = getCryptoSource(),
): string => {
  let suffix = "";

  while (suffix.length < ENTITY_ID_SUFFIX_LENGTH) {
    const bytes = new Uint8Array(ENTITY_ID_SUFFIX_LENGTH - suffix.length);
    cryptoSource.getRandomValues(bytes);

    for (const byte of bytes) {
      if (byte >= ENTITY_ID_BYTE_LIMIT) continue;
      suffix += ENTITY_ID_ALPHABET[byte % ENTITY_ID_ALPHABET.length];
      if (suffix.length === ENTITY_ID_SUFFIX_LENGTH) break;
    }
  }

  return `${entityIdPrefixes[kind]}${suffix}`;
};
