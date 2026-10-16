import { describe, expect, test } from "bun:test";
import { translateStyledLine } from "./line-translate";
import { buildChromeRules, annotateValueSpans, translateOptions, type SettingsKoData } from "./settings-panel";

const strip = (s: string) => s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");
const width = (s: string) => {
  let w = 0;
  for (const ch of strip(s)) {
    const cp = ch.codePointAt(0) ?? 0;
    w += cp >= 0xac00 && cp <= 0xd7a3 ? 2 : 1;
  }
  return w;
};

const data: SettingsKoData = {
  chrome: {
    title: [["Settings", "설정"]],
    tabs: [
      ["Appearance", "모양"],
      ["Model", "모델"],
      ["Interaction", "상호작용"],
      ["Context", "컨텍스트"],
    ],
    groups: [
      ["Theme", "테마"],
      ["Input", "입력"],
    ],
    pairs: [["to change", "변경"]],
    patterns: [["(\\d+) match(?:es)?", "$1건"]],
  },
};

const rules = buildChromeRules(data);
const translate = (line: string) => translateStyledLine(line, rules);

describe("chrome rules on real panel lines", () => {
  test("translates the title border without shifting it", () => {
    const line = "╭─ Settings ─────────────────────────╮";
    const out = translate(line);
    expect(strip(out)).toBe("╭─ 설정     ─────────────────────────╮");
    expect(width(out)).toBe(width(line));
  });

  test("translates the tab strip", () => {
    const line = "│  🎨 Appearance    🤖 Model    ⌨ Interaction    📋 Context    🧠 Memory    📁 Files  │";
    const out = translate(line);
    expect(strip(out)).toContain("모양");
    expect(strip(out)).toContain("모델");
    expect(strip(out)).toContain("상호작용");
    expect(strip(out)).toContain("컨텍스트");
    expect(width(out)).toBe(width(line));
  });

  test("translates section cells in both columns (sidebar and group header)", () => {
    const line = "│   Theme              │   Theme                                                                     █ │";
    const out = translate(line);
    const plain = strip(out);
    expect(plain).not.toContain("Theme");
    expect(plain.replace(/ /g, "")).toBe("│테마│테마█│");
    expect(width(out)).toBe(width(line));
  });

  test("group rule leaves setting rows (name + value cell) untouched", () => {
    const line = "│                      │   Theme                                                  true                █ │";
    expect(translate(line)).toBe(line);
  });

  test("translates focused sidebar rows and icon-prefixed group headers", () => {
    const focused = "│ ❯ Input              │   입력                                                          █ │";
    const focusedOut = strip(translate(focused));
    expect(focusedOut).toContain("❯ 입력");
    expect(width(translate(focused))).toBe(width(focused));

    const iconHeader = "│   ⌨ Interaction                                                                                                  █ │";
    const iconOut = strip(translate(iconHeader));
    expect(iconOut).toContain("⌨ 상호작용");
    expect(width(translate(iconHeader))).toBe(width(iconHeader));
  });

  test("translates footer hints on any line", () => {
    const line = "⏎/␣ to change · ⇥ to jump sections · ⎋ to close";
    const out = translate(line);
    expect(strip(out)).toStartWith("⏎/␣ 변경");
    expect(width(out)).toBe(width(line));
  });

  test("translates the search banner count", () => {
    const out = translate("  🔍 api 12 matches ");
    expect(strip(out)).toContain("12건");
    expect(width(out)).toBe(width("  🔍 api 12 matches "));
  });

  test("leaves unrelated lines untouched", () => {
    const line = "│   Dark Theme                  titanium                                      │";
    expect(translate(line)).toBe(line);
  });
});

describe("option translations", () => {
  const host = [
    { value: "default", label: "Default", description: "Uses the model's policy" },
    { value: "always", label: "Always", description: "Force it" },
    { value: "keep", label: "Keep" },
  ];

  test("object form replaces label and description", () => {
    const out = translateOptions(host, {
      default: { label: "기본", description: "선택된 모델 정책 사용" },
    }) as any[];
    expect(out[0]).toEqual({ value: "default", label: "기본(default)", description: "선택된 모델 정책 사용" });
    expect(out[0]).not.toBe(host[0]);
  });

  test("string form replaces only the label", () => {
    const out = translateOptions(host, { always: "항상" }) as any[];
    expect(out[1]).toEqual({ value: "always", label: "항상(always)", description: "Force it" });
  });

  test("description-only keeps the host label", () => {
    const out = translateOptions(host, { keep: { description: "유지" } }) as any[];
    expect(out[2]).toEqual({ value: "keep", label: "Keep", description: "유지" });
  });

  test("labels that already read as the value stay unannotated", () => {
    const out = translateOptions(
      [{ value: "mnemopi", label: "Mnemopi" }],
      { mnemopi: "Mnemopi" },
    ) as any[];
    expect(out[0].label).toBe("Mnemopi");
  });

  test("labels ending in a paren get a separating space", () => {
    const out = translateOptions(
      [{ value: "short", label: "짧게 (5분)" }],
      { short: "짧게 (5분)" },
    ) as any[];
    expect(out[0].label).toBe("짧게 (5분) (short)");
  });

  test("function descriptions are never replaced", () => {
    const dynamic = [{ value: "x", label: "X", description: () => "live" }];
    const out = translateOptions(dynamic, { x: { label: "엑스", description: "정적" } }) as any[];
    expect(out[0].label).toBe("엑스(x)");
    expect(typeof out[0].description).toBe("function");
  });

  test("untouched options and non-arrays pass through", () => {
    const out = translateOptions(host, {}) as any[];
    expect(out[1]).toBe(host[1]);
    expect(translateOptions(undefined, { a: "b" })).toBe(undefined);
    expect(translateOptions("nope", { a: "b" })).toBe("nope");
  });
});

describe("row value annotations", () => {
  const rows = [{ label: "메모리 백엔드", value: "local", annotated: "로컬(local)" }];
  const run = (line: string) =>
    translateStyledLine(line, [{ candidates: (plain) => annotateValueSpans(plain, rows) }]);

  test("annotates the value cell after the row label", () => {
    const line = `│ ❯ 메모리 백엔드           local${" ".repeat(30)}█ │`;
    const out = run(line);
    expect(strip(out)).toContain("메모리 백엔드           로컬(local)");
    expect(width(out)).toBe(width(line));
  });

  test("ignores a row whose value does not match", () => {
    const line = `│   메모리 백엔드           remote${" ".repeat(30)}█ │`;
    expect(run(line)).toBe(line);
  });

  test("ignores prose that merely mentions the label", () => {
    const line = "│   설명: 메모리 백엔드 값을 로컬로 바꿉니다";
    expect(run(line)).toBe(line);
  });
});
