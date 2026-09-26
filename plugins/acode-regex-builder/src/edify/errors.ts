/** Errors mirroring edify.errors — `name` equals the Python exception class name (parity). */

export class EdifyError extends Error {}

export class CannotCallSubexpressionError extends EdifyError {}
export class DanglingQuantifierError extends EdifyError {}
export class CannotEndWhileBuildingRootExpressionError extends EdifyError {}
export class StartInputAlreadyDefinedError extends EdifyError {}
export class EndInputAlreadyDefinedError extends EdifyError {}
export class CannotDefineStartAfterEndError extends EdifyError {}
export class StackedQuantifierError extends EdifyError {}
export class MustBeOneCharacterError extends EdifyError {}
export class MustBeSingleCharacterError extends EdifyError {}
export class MustHaveASmallerValueError extends EdifyError {}
export class MustBePositiveIntegerError extends EdifyError {}
export class MustBeIntegerGreaterThanZeroError extends EdifyError {}
export class MustBeLessThanError extends EdifyError {}
export class MustBeAtLeastOneLiteralError extends EdifyError {}
export class NameNotValidError extends EdifyError {}
export class CannotCreateDuplicateNamedGroupError extends EdifyError {}
export class InvalidTotalCaptureGroupsIndexError extends EdifyError {}
export class NamedGroupDoesNotExistError extends EdifyError {}
export class CannotNegateNonCharacterMemberError extends EdifyError {}
export class UnsupportedFlagError extends EdifyError {}

const ERRORS: Array<[new (message: string) => EdifyError, string]> = [
  [CannotCallSubexpressionError, "CannotCallSubexpressionError"],
  [DanglingQuantifierError, "DanglingQuantifierError"],
  [CannotEndWhileBuildingRootExpressionError, "CannotEndWhileBuildingRootExpressionError"],
  [StartInputAlreadyDefinedError, "StartInputAlreadyDefinedError"],
  [EndInputAlreadyDefinedError, "EndInputAlreadyDefinedError"],
  [CannotDefineStartAfterEndError, "CannotDefineStartAfterEndError"],
  [StackedQuantifierError, "StackedQuantifierError"],
  [MustBeOneCharacterError, "MustBeOneCharacterError"],
  [MustBeSingleCharacterError, "MustBeSingleCharacterError"],
  [MustHaveASmallerValueError, "MustHaveASmallerValueError"],
  [MustBePositiveIntegerError, "MustBePositiveIntegerError"],
  [MustBeIntegerGreaterThanZeroError, "MustBeIntegerGreaterThanZeroError"],
  [MustBeLessThanError, "MustBeLessThanError"],
  [MustBeAtLeastOneLiteralError, "MustBeAtLeastOneLiteralError"],
  [NameNotValidError, "NameNotValidError"],
  [CannotCreateDuplicateNamedGroupError, "CannotCreateDuplicateNamedGroupError"],
  [InvalidTotalCaptureGroupsIndexError, "InvalidTotalCaptureGroupsIndexError"],
  [NamedGroupDoesNotExistError, "NamedGroupDoesNotExistError"],
  [CannotNegateNonCharacterMemberError, "CannotNegateNonCharacterMemberError"],
  [UnsupportedFlagError, "UnsupportedFlagError"],
];

for (const [ctor, name] of ERRORS) {
  ctor.prototype.name = name;
}
