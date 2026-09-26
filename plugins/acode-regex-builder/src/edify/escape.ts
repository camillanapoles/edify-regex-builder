/** Escapes mirroring edify/compile/escape.py (Python 3.7+ re.escape semantics). */

const SPECIAL = new Set(
  ["(", ")", "[", "]", "{", "}", "?", "*", "+", "-", "|", "^", "$", "\\", ".", "&", "~", "#",
    " ", "\t", "\n", "\r", "\v", "\f"],
);

const RANGE_BOUND = new Set(["\\", "]", "^", "-"]);

/** Escape for literals outside a character class: exactly Python re.escape's special set. */
export function escapeSpecial(value: string): string {
  return Array.from(value)
    .map((c) => (SPECIAL.has(c) ? "\\" + c : c))
    .join("");
}

/** Escape a [a-z] range endpoint: backslash iff syntactically active anywhere in a class. */
export function escapeRangeBound(character: string): string {
  return RANGE_BOUND.has(character) ? "\\" + character : character;
}

/** Escape a class body: \ and ] always; ^ at position 0; - strictly interior. */
export function escapeForCharClass(characters: string): string {
  const chars = Array.from(characters);
  const lastIndex = chars.length - 1;
  return chars
    .map((c, position) => {
      if (c === "\\" || c === "]") return "\\" + c;
      if (c === "^" && position === 0) return "\\^";
      if (c === "-" && 0 < position && position < lastIndex) return "\\-";
      return c;
    })
    .join("");
}
