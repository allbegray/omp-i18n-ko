import { describe, expect, test } from "bun:test";
import { translateStyledLine } from "./line-translate";
import { buildChromeRules, type SettingsKoData } from "./settings-panel";

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
