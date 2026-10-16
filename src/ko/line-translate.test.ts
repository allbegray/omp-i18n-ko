import { describe, expect, test } from "bun:test";
import { displayWidth, translateStyledLine, type ChromeRule } from "./line-translate";

const SGR = (code: string) => `\x1b[${code}m`;
const strip = (s: string) => s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");

describe("translateStyledLine", () => {
  test("replaces a pair and keeps surrounding escape sequences", () => {
    const line = `${SGR("36")}Theme${SGR("39")} rest`;
    const rules: ChromeRule[] = [{ pairs: [["Theme", "테마"]] }];
    const out = translateStyledLine(line, rules);
    expect(out).toBe(`${SGR("36")}테마 ${SGR("39")} rest`);
    expect(strip(out)).toBe("테마  rest");
  });

  test("pads replacement to the original display width", () => {
    const out = translateStyledLine("Settings", [{ pairs: [["Settings", "설정"]] }]);
    expect(displayWidth(out)).toBe(displayWidth("Settings"));
    expect(out).toBe("설정    ");
  });

  test("longest match wins at the same start position", () => {
    const rules: ChromeRule[] = [{ pairs: [["to change", "변경"], ["to", "↦"]] }];
    const out = translateStyledLine("to change", rules);
    expect(out).toBe("변경     ");
  });

  test("detect gate skips lines", () => {
    const rules: ChromeRule[] = [{ detect: plain => plain.startsWith("│"), pairs: [["Theme", "테마"]] }];
    expect(translateStyledLine("Theme", rules)).toBe("Theme");
    expect(translateStyledLine("│ Theme", rules)).toBe("│ 테마 ");
  });

  test("patterns expand capture groups", () => {
    const rules: ChromeRule[] = [{ patterns: [["(\\d+) match(?:es)?", "$1건"]] }];
    const one = translateStyledLine("1 match", rules);
    const many = translateStyledLine("12 matches", rules);
    expect(strip(one)).toBe("1건    ");
    expect(strip(many)).toBe("12건      ");
    expect(displayWidth(one)).toBe(displayWidth("1 match"));
  });

  test("drops escape sequences strictly inside a replaced span", () => {
    const line = `Th${SGR("1")}e${SGR("22")}me`;
    const out = translateStyledLine(line, [{ pairs: [["Theme", "테마"]] }]);
    expect(out).toBe("테마 ");
  });

  test("custom candidates drive position-sensitive replacements", () => {
    const rules: ChromeRule[] = [
      {
        candidates: plain => {
          const idx = plain.indexOf("Theme\n");
          return idx === -1 ? [] : [{ start: idx, end: idx + 5, text: "테마" }];
        },
      },
    ];
    expect(translateStyledLine("Theme\n", rules)).toBe("테마 \n");
  });

  test("a wider replacement absorbs the following spaces", () => {
    const out = translateStyledLine("Context   more", [{ pairs: [["Context", "컨텍스트"]] }]);
    expect(out).toBe("컨텍스트  more");
    expect(displayWidth(out)).toBe(displayWidth("Context   more"));
  });

  test("a wider replacement without spaces is skipped", () => {
    const line = "Context│more";
    expect(translateStyledLine(line, [{ pairs: [["Context", "컨텍스트"]] }])).toBe(line);
  });

  test("lines without visible text pass through untouched", () => {
    const line = `${SGR("0")}${SGR("39")}`;
    expect(translateStyledLine(line, [{ pairs: [["Theme", "테마"]] }])).toBe(line);
  });

  test("no match returns the identical string", () => {
    const line = `${SGR("31")}Nothing here`;
    expect(translateStyledLine(line, [{ pairs: [["Theme", "테마"]] }])).toBe(line);
  });

  test("astral icons before a match do not shift the replaced range", () => {
    const line = "│  🎨 Appearance    🤖 Model │";
    const rules: ChromeRule[] = [{ pairs: [["Appearance", "모양"], ["Model", "모델"]] }];
    const out = translateStyledLine(line, rules);
    expect(out).not.toContain("ppearance");
    expect(out).not.toContain("Appearance");
    expect(out).not.toContain("Model");
    expect(out).toContain("🎨 모양");
    expect(out).toContain("🤖 모델");
    expect(displayWidth(out)).toBe(displayWidth(line));
  });

  test("candidates stay usable after astral icons", () => {
    const line = "🎨 Theme";
    const rules: ChromeRule[] = [
      {
        candidates: plain => {
          const idx = plain.indexOf("Theme");
          return idx === -1 ? [] : [{ start: idx, end: idx + 5, text: "테마" }];
        },
      },
    ];
    expect(translateStyledLine(line, rules)).toBe("🎨 테마 ");
  });

  test("broken rules are ignored", () => {
    const rules = [
      { pairs: [["Theme", "테마"]] },
      { patterns: [["(", "x"]] },
    ] as ChromeRule[];
    expect(translateStyledLine("Theme", rules)).toBe("테마 ");
  });

  test("does not throw on malformed input", () => {
    expect(translateStyledLine("Theme", undefined as unknown as ChromeRule[])).toBe("Theme");
  });
});

describe("displayWidth", () => {
  test("Hangul syllables count as two cells", () => {
    expect(displayWidth("설정")).toBe(4);
    expect(displayWidth("abc")).toBe(3);
    expect(displayWidth("a설")).toBe(3);
  });

  test("zero-width marks count as zero", () => {
    expect(displayWidth("\u0301")).toBe(0);
  });
});
