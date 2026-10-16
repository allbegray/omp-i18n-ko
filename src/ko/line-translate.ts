/**
 * ANSI-aware, width-preserving line translator for overlay chrome.
 *
 * The Korean settings panel is the host's own pi-tui
 * `SettingsSelectorComponent`, rendered as an overlay. All *data* text
 * (setting labels, descriptions, enum options) is translated before it
 * reaches the component, so this module only handles the component's own
 * chrome: the frame title, tab strip, section headings, footer key hints and
 * the search banner.
 *
 * Rules are matched against the *visible* text of a rendered line (ANSI
 * escape sequences are skipped while scanning). A replacement:
 *   - keeps every escape sequence outside the matched span untouched, so
 *     colors and styles continue to wrap the translated text;
 *   - pads the replacement back to the matched display width, so borders,
 *     columns and right-aligned values never shift;
 *   - drops escape sequences strictly inside the matched span (in practice
 *     styles wrap whole phrases, never fragments we replace).
 *
 * Everything is best-effort: any internal failure returns the line unchanged.
 */

/** One replacement: [start, end) indices into the line's visible text. */
export interface Span {
  start: number;
  end: number;
  text: string;
}

export interface ChromeRule {
  /** Runs only on lines whose visible text passes this test. */
  detect?: (plain: string) => boolean;
  /** Exact English → Korean pairs; every occurrence, longest match wins. */
  pairs?: ReadonlyArray<readonly [string, string]>;
  /** Regex sources (compiled with the `u` flag) → replacement; `$1`..`$9` work. */
  patterns?: ReadonlyArray<readonly [string, string]>;
  /** Custom span producers for position-sensitive chrome (e.g. the sidebar). */
  candidates?: (plain: string) => Span[];
}

interface VisibleChar {
  ch: string;
  start: number;
  end: number;
}

/** CSI / OSC / charset / two-char escape sequences, sticky for scanning. */
const ESCAPE = /\x1b(?:\[[0-9;?]*[ -/]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\)?|[()][0-9A-Za-z]|[@-Z\\-_])/y;

// East Asian Width families relevant to our replacements (Hangul, CJK
// punctuation) plus combining marks that occupy no cells.
const WIDE = /[\u1100-\u115F\u2E80-\u303E\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA000-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6]/u;
const ZERO = /[\u0300-\u036F\u200B-\u200F\u2028-\u202E\u2060-\u2064\uFE00-\uFE0F\uFEFF]/u;

/** Terminal cell width for a single code point (pragmatic subset). */
function charWidth(ch: string): number {
  if (ZERO.test(ch)) return 0;
  if (WIDE.test(ch)) return 2;
  return 1;
}

/** Visible cell width of a string (no ANSI handling). */
export function displayWidth(text: string): number {
  let width = 0;
  for (const ch of text) width += charWidth(ch);
  return width;
}

/** Split a rendered line into visible characters with their byte offsets. */
function scan(line: string): VisibleChar[] {
  const chars: VisibleChar[] = [];
  let i = 0;
  while (i < line.length) {
    if (line.charCodeAt(i) === 0x1b) {
      ESCAPE.lastIndex = i;
      const m = ESCAPE.exec(line);
      if (m && m.index === i) {
        i += m[0].length;
        continue;
      }
      i += 1; // lone ESC — skip one byte
      continue;
    }
    const cp = line.codePointAt(i);
    if (cp === undefined) break;
    const len = cp > 0xffff ? 2 : 1;
    chars.push({ ch: line.slice(i, i + len), start: i, end: i + len });
    i += len;
  }
  return chars;
}

function expandTemplate(template: string, match: RegExpExecArray): string {
  return template.replace(/\$([&1-9])/g, (_all, ref: string) => {
    if (ref === "&") return match[0];
    const group = Number(ref);
    return match[group] ?? "";
  });
}

function collectPairs(plain: string, pairs: ReadonlyArray<readonly [string, string]>, out: Span[]): void {
  for (const pair of pairs) {
    const [en, ko] = pair ?? [];
    if (typeof en !== "string" || en.length === 0 || typeof ko !== "string" || ko.length === 0) continue;
    let index = plain.indexOf(en);
    while (index !== -1) {
      out.push({ start: index, end: index + en.length, text: ko });
      index = plain.indexOf(en, index + en.length);
    }
  }
}

function collectPatterns(plain: string, patterns: ReadonlyArray<readonly [string, string]>, out: Span[]): void {
  for (const pair of patterns) {
    const [source, to] = pair ?? [];
    if (typeof source !== "string" || source.length === 0 || typeof to !== "string") continue;
    let re: RegExp;
    try {
      re = new RegExp(source, "gu");
    } catch {
      continue;
    }
    let m: RegExpExecArray | null;
    while ((m = re.exec(plain)) !== null) {
      if (m[0].length === 0) {
        re.lastIndex += 1;
        continue;
      }
      out.push({ start: m.index, end: m.index + m[0].length, text: expandTemplate(to, m) });
    }
  }
}

/**
 * Translate one rendered line with the given rules. Never throws; returns the
 * line unchanged when nothing matches or anything goes wrong.
 */
export function translateStyledLine(line: string, rules: readonly ChromeRule[]): string {
  try {
    if (!line || !Array.isArray(rules) || rules.length === 0) return line;

    const chars = scan(line);
    if (chars.length === 0) return line;
    let plain = "";
    for (const ch of chars) plain += ch.ch;

    // Rules match against the visible text, where indices are UTF-16 code
    // units. The apply loop below indexes `chars`, where every astral code
    // point (emoji icons!) is a single entry — so map unit indices back to
    // character indices before the spans are used.
    const plainToChar: number[] = [];
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i]!.ch;
      for (let unit = 0; unit < ch.length; unit++) plainToChar.push(i);
    }
    plainToChar.push(chars.length);

    const spans: Span[] = [];
    for (const rule of rules) {
      try {
        if (rule.detect && !rule.detect(plain)) continue;
        if (rule.candidates) spans.push(...rule.candidates(plain));
        if (rule.pairs) collectPairs(plain, rule.pairs, spans);
        if (rule.patterns) collectPatterns(plain, rule.patterns, spans);
      } catch {
        // A broken rule never affects the others.
      }
    }

    // Convert every rule-produced span (visible-text units) into character
    // indices; spans that land on empty ranges are dropped.
    const mapped: Span[] = [];
    for (const span of spans) {
      const start = plainToChar[span.start];
      const end = plainToChar[span.end];
      if (start === undefined || end === undefined || end <= start) continue;
      mapped.push({ start, end, text: span.text });
    }
    if (mapped.length === 0) return line;

    // Greedy non-overlapping selection: earlier start wins, longer match at
    // the same start wins. A replacement wider than its match absorbs the
    // following spaces (never shifts columns); without spaces it is skipped.
    mapped.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
    const accepted: Span[] = [];
    let covered = -1;
    for (const span of mapped) {
      if (span.start < covered || span.end <= span.start) continue;
      let end = Math.min(span.end, chars.length);
      let originalWidth = 0;
      for (let i = span.start; i < end; i++) originalWidth += charWidth(chars[i]!.ch);
      let overflow = displayWidth(span.text) - originalWidth;
      while (overflow > 0 && end < chars.length && chars[end]!.ch === " ") {
        end += 1;
        overflow -= 1;
      }
      if (overflow > 0) continue;
      accepted.push({ start: span.start, end, text: span.text });
      covered = end;
    }
    if (accepted.length === 0) return line;

    let out = "";
    let byteCursor = 0;
    for (const span of accepted) {
      const first = chars[span.start];
      const last = chars[span.end - 1];
      if (!first || !last) continue;
      out += line.slice(byteCursor, first.start);

      let originalWidth = 0;
      for (let i = span.start; i < span.end; i++) originalWidth += charWidth(chars[i]!.ch);
      const replacementWidth = displayWidth(span.text);
      out += span.text;
      if (replacementWidth < originalWidth) out += " ".repeat(originalWidth - replacementWidth);
      byteCursor = last.end;
    }
    out += line.slice(byteCursor);
    return out;
  } catch {
    return line;
  }
}
