import { describe, expect, it } from "vitest";
import {
  getUnicodeCodePointLength,
  truncateToUnicodeCodePoints,
} from "../club";

describe("클럽 소개 유니코드 길이", () => {
  it("BMP 문자, 단일 이모지, ZWJ 이모지를 코드포인트 단위로 계산한다", () => {
    expect(getUnicodeCodePointLength("클럽 소개")).toBe(5);
    expect(getUnicodeCodePointLength("😀")).toBe(1);
    expect(getUnicodeCodePointLength("👨‍👩‍👧‍👦")).toBe(7);
  });

  it("코드포인트 경계에서만 소개를 자른다", () => {
    const description = "😀".repeat(501);

    expect(truncateToUnicodeCodePoints(description, 500)).toBe("😀".repeat(500));
  });
});
