/** edify element AST — discriminated union mirroring edify/elements/types/*. */

export type LeafKind =
  | "start_of_input"
  | "end_of_input"
  | "any_char"
  | "whitespace_char"
  | "non_whitespace_char"
  | "digit"
  | "non_digit"
  | "word"
  | "non_word"
  | "word_boundary"
  | "non_word_boundary"
  | "new_line"
  | "carriage_return"
  | "tab"
  | "null_byte"
  | "letter"
  | "uppercase"
  | "lowercase"
  | "alphanumeric"
  | "unicode_letter"
  | "unicode_uppercase"
  | "unicode_lowercase"
  | "unicode_alphanumeric"
  | "noop";

export interface LeafElement {
  kind: LeafKind;
}
export interface CharElement {
  kind: "char";
  value: string;
}
export interface StringElement {
  kind: "string";
  value: string;
}
export interface RangeElement {
  kind: "range";
  start: string;
  end: string;
}
export interface AnyOfCharsElement {
  kind: "any_of_chars";
  value: string;
}
export interface AnythingButCharsElement {
  kind: "anything_but_chars";
  value: string;
}
export interface AnythingButRangeElement {
  kind: "anything_but_range";
  start: string;
  end: string;
}
export interface AnythingButStringElement {
  kind: "anything_but_string";
  value: string;
}
export interface CaptureElement {
  kind: "capture";
  children: Element[];
}
export interface NamedCaptureElement {
  kind: "named_capture";
  name: string;
  children: Element[];
}
export interface BackReferenceElement {
  kind: "back_reference";
  index: number;
}
export interface NamedBackReferenceElement {
  kind: "named_back_reference";
  name: string;
}
export interface GroupElement {
  kind: "group";
  children: Element[];
}
export interface AnyOfElement {
  kind: "any_of";
  children: Element[];
}
export interface AnythingButAnyOfElement {
  kind: "anything_but_any_of";
  children: Element[];
}
export interface AtomicElement {
  kind: "atomic";
  children: Element[];
}
export interface SubexpressionElement {
  kind: "subexpression";
  children: Element[];
}
export interface AssertAheadElement {
  kind: "assert_ahead";
  children: Element[];
}
export interface AssertNotAheadElement {
  kind: "assert_not_ahead";
  children: Element[];
}
export interface AssertBehindElement {
  kind: "assert_behind";
  children: Element[];
}
export interface AssertNotBehindElement {
  kind: "assert_not_behind";
  children: Element[];
}

export type QuantifierKind =
  | "optional"
  | "zero_or_more"
  | "zero_or_more_lazy"
  | "one_or_more"
  | "one_or_more_lazy"
  | "exactly"
  | "at_least"
  | "at_most"
  | "between"
  | "between_lazy"
  | "optional_possessive"
  | "zero_or_more_possessive"
  | "one_or_more_possessive"
  | "at_least_possessive"
  | "at_most_possessive"
  | "between_possessive";

export interface QuantifierElement {
  kind: QuantifierKind;
  child: Element;
  n?: number;
  lower?: number;
  upper?: number;
}
export interface RootElement {
  kind: "root";
  children: Element[];
}

export type Element =
  | LeafElement
  | CharElement
  | StringElement
  | RangeElement
  | AnyOfCharsElement
  | AnythingButCharsElement
  | AnythingButRangeElement
  | AnythingButStringElement
  | CaptureElement
  | NamedCaptureElement
  | BackReferenceElement
  | NamedBackReferenceElement
  | GroupElement
  | AnyOfElement
  | AnythingButAnyOfElement
  | AtomicElement
  | SubexpressionElement
  | AssertAheadElement
  | AssertNotAheadElement
  | AssertBehindElement
  | AssertNotBehindElement
  | QuantifierElement
  | RootElement;
