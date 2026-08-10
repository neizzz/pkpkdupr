import { describe, expect, it } from "vitest";
import { getCommonAffiliationNames } from "../player";

const participant = (names: string[]) => ({
  affiliations: names.map((name, index) => ({
    name,
    isPrimary: index === 0,
  })),
});

describe("getCommonAffiliationNames", () => {
  it("모든 참가자가 공유한 여러 소속을 순서대로 저장한다", () => {
    expect(
      getCommonAffiliationNames([
        participant(["서울 피클볼", "주말 클럽", "개인 소속"]),
        participant(["주말 클럽", "서울 피클볼"]),
        participant(["서울 피클볼", "주말 클럽"]),
      ]),
    ).toEqual(["서울 피클볼", "주말 클럽"]);
  });

  it("공백과 대소문자만 다른 표기는 같은 소속으로 취급한다", () => {
    expect(
      getCommonAffiliationNames([
        participant(["  Pickle   Seoul  "]),
        participant(["pickle seoul"]),
      ]),
    ).toEqual(["pickle seoul"]);
  });

  it("공통 소속이 없으면 빈 배열을 저장한다", () => {
    expect(
      getCommonAffiliationNames([
        participant(["서울"]),
        participant(["부산"]),
      ]),
    ).toEqual([]);
  });
});
