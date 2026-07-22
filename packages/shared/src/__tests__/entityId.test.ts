import { describe, expect, it } from "vitest";
import {
  entityIdPrefixes,
  generateEntityId,
  isEntityId,
} from "../entityId";

describe("entity IDs", () => {
  it.each(Object.keys(entityIdPrefixes) as Array<keyof typeof entityIdPrefixes>)(
    "%s ID는 접두사를 포함해 8글자이며 소문자와 숫자 suffix를 사용한다",
    (kind) => {
      const id = generateEntityId(kind);

      expect(id).toMatch(
        new RegExp(`^${entityIdPrefixes[kind]}[a-z0-9]{7}$`),
      );
      expect(isEntityId(id, kind)).toBe(true);
    },
  );

  it("다른 접두사, 대문자 suffix, 길이가 다른 값을 거부한다", () => {
    expect(isEntityId("Pabc1234", "match")).toBe(false);
    expect(isEntityId("Mabc123", "match")).toBe(false);
    expect(isEntityId("Mabc12D4", "match")).toBe(false);
  });
});
