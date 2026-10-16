/**
 * Pure translation core for omp-i18n-ko.
 *
 * No omp imports and no I/O: this module is unit-testable on its own and is
 * safe to call from anywhere. The extension entry point (index.ts) owns all
 * runtime wiring.
 *
 * Translation happens in three tiers, all keyed on full strings — there is no
 * substring surgery, so partial-word matches (the "supercalifragilistic"
 * class of bugs) cannot happen:
 *
 *   1. `exact`    — whole-string map for static text.
 *   2. `labels`   — "Label: state" prefixes ("Plan: off" -> "계획 모드: 꺼짐").
 *   3. `state` / `statePatterns` — the state part of a labelled string,
 *      plus numbered dynamic forms ("3 active tools" -> "3개 활성 도구").
 *   4. `textPatterns` — whole-string regexes for host strings that embed
 *      live data, such as themed key hints inside /switch and /effort.
 *
 * Composed autocomplete text ("[prompt] - Toggle plan mode") is split on the
 * first " - ": the head (a usage hint) is left untouched and the tail is
 * translated recursively.
 */

export interface StatePattern {
  /** Regular expression source, compiled with the `u` flag. */
  pattern: string;
  /** Replacement string; `$1`..`$9` select capture groups. */
  replacement: string;
}

export interface TranslationTable {
  exact?: Record<string, string>;
  labels?: Record<string, string>;
  state?: Record<string, string>;
  statePatterns?: StatePattern[];
  /**
   * Regexes tried against whole composed text (description/nativeDetail),
   * for dynamic host strings that embed live data such as themed key hints.
   */
  textPatterns?: StatePattern[];
  /** Literal suffixes rewritten wherever they end a string, e.g. " (current)". */
  suffixes?: Array<[string, string]>;
}

export interface TranslatableItem {
  description?: string;
  nativeDetail?: string;
  state?: string;
  [key: string]: unknown;
}

export interface Translator {
  /** Number of exact entries loaded (used by `/ko status`). */
  readonly size: number;
  /** Translate one autocomplete item's user-visible text fields. Returns a copy. */
  translateItem<T extends TranslatableItem>(item: T): T;
  /** Translate a composed "hint - text" or "Label: state" string. */
  translateText(text: string): string;
  /** Translate a bare state value ("off", "3 active tools"). */
  translateState(state: string): string;
}

const HINT_SEPARATOR = " - ";
const LABEL_PATTERN = /^([A-Za-z][A-Za-z0-9 /-]*): (.*)$/u;
const WORD_PAREN_PATTERN = /^([A-Za-z][A-Za-z0-9 ]*) \((.+)\)$/u;

export function createTranslator(table: TranslationTable): Translator {
  const exact: Record<string, string> = table.exact ?? {};
  const labels: Record<string, string> = table.labels ?? {};
  const stateMap: Record<string, string> = table.state ?? {};
  const compile = (list: StatePattern[] | undefined) =>
    (Array.isArray(list) ? list : []).flatMap(p => {
      if (typeof p?.pattern !== "string" || typeof p?.replacement !== "string") return [];
      try {
        return [{ re: new RegExp(p.pattern, "u"), to: p.replacement }];
      } catch {
        return [];
      }
    });
  const patterns = compile(table.statePatterns);
  const textPatterns = compile(table.textPatterns);
  const suffixes = (Array.isArray(table.suffixes) ? table.suffixes : []).filter(
    (s): s is [string, string] => Array.isArray(s) && typeof s[0] === "string" && typeof s[1] === "string",
  );

  function applySuffixes(text: string): string {
    for (const [from, to] of suffixes) {
      if (from.length > 0 && text.length > from.length && text.endsWith(from)) {
        return text.slice(0, -from.length) + to;
      }
    }
    return text;
  }

  function matchPattern(text: string): string | null {
    for (const { re, to } of patterns) {
      if (re.test(text)) return text.replace(re, to);
    }
    return null;
  }

  /** Translate the inner text of "word (inner)": a mapped word, a pattern, or as-is. */
  function translateInner(text: string): string {
    const mapped = stateMap[text];
    if (mapped !== undefined) return mapped;
    return matchPattern(text) ?? text;
  }

  function translateState(state: string): string {
    const hit = stateMap[state];
    if (hit !== undefined) return hit;

    const m = WORD_PAREN_PATTERN.exec(state);
    if (m) {
      const word = stateMap[m[1]!];
      if (word !== undefined) return `${word} (${translateInner(m[2]!)})`;
    }

    return matchPattern(state) ?? applySuffixes(state);
  }

  function translateCore(text: string): string {
    const hit = exact[text];
    if (hit !== undefined) return hit;

    const m = LABEL_PATTERN.exec(text);
    if (m) {
      const label = labels[m[1]!];
      if (label !== undefined) return `${label}: ${translateState(m[2]!)}`;
    }

    return text;
  }

  function translatePlain(text: string): string {
    const core = translateCore(text);
    if (core !== text) return core;

    for (const { re, to } of textPatterns) {
      if (re.test(text)) return text.replace(re, to);
    }

    return applySuffixes(text);
  }

  function translateText(text: string): string {
    const direct = translatePlain(text);
    if (direct !== text) return direct;

    const idx = text.indexOf(HINT_SEPARATOR);
    if (idx > 0) {
      const head = text.slice(0, idx);
      const tail = text.slice(idx + HINT_SEPARATOR.length);
      const translated = translatePlain(tail);
      if (translated !== tail) return head + HINT_SEPARATOR + translated;
    }

    return text;
  }

  return {
    get size() {
      return Object.keys(exact).length;
    },
    translateItem(item) {
      const out: TranslatableItem = { ...item };
      if (typeof out.description === "string") out.description = translateText(out.description);
      if (typeof out.nativeDetail === "string") out.nativeDetail = translateText(out.nativeDetail);
      if (typeof out.state === "string") out.state = translateState(out.state);
      return out as typeof item;
    },
    translateText,
    translateState,
  };
}
