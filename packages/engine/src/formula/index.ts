// The OCF formula language: parser, printer, type checker, evaluator and dice roller.
// Specified in packages/spec/docs/formulas.md.

import type { Node } from './ast.ts';
import { type CheckContext, checkTree, type FType } from './check.ts';
import { capture, type Result } from './errors.ts';
import { type EvalContext, evaluateTree } from './evaluate.ts';
import { parseTree } from './parser.ts';
import { printTree } from './printer.ts';
import { type FaceSource, type RollResult, rollDice } from './roll.ts';
import type { DiceValue, Value } from './values.ts';

export type { BinaryOp, Compare, DiceModifier, DiceModifierType, Node } from './ast.ts';
export { MODIFIER_ORDER } from './ast.ts';
export type { CheckContext, FType, ObjectType } from './check.ts';
export { assignable, fieldFormulaType, parseTypeName, typeName } from './check.ts';
export { aggregatedFields, calculationOrder, references, replaceRooted } from './deps.ts';
export type { FieldView } from './aggregates.ts';
export { aggregateOver } from './aggregates.ts';
export type { FormulaError, FormulaErrorCode, Result } from './errors.ts';
export type { CharacterQueries, EvalContext } from './evaluate.ts';
export { keptFields, OWNER_GRANTED, OWNER_PICKS, valuesEqual } from './evaluate.ts';
export { longDecimals, RESERVED } from './lexer.ts';
export { children, treeDepth } from './parser.ts';
export type { FaceSource, RolledFace, RolledTerm, RollResult } from './roll.ts';
export { facesFrom } from './roll.ts';
export type { DiceTerm, DiceValue, Value } from './values.ts';
export { DECIMAL_PLACES, fromData, roundDecimal, toData, wrapValue } from './values.ts';

export function parse(text: string): Result<Node> {
  return capture(() => parseTree(text));
}

const parsed = new Map<string, Result<Node>>();
/** Bounds the memo: a long-running app sees many characters' homebrew formulas. */
const MAX_PARSED = 50_000;

/** `parse`, memoized by text. The tree is shared: callers must not modify it. */
export function parseCached(text: string): Result<Node> {
  let tree = parsed.get(text);
  if (!tree) {
    if (parsed.size >= MAX_PARSED) parsed.clear();
    parsed.set(text, (tree = parse(text)));
  }
  return tree;
}

export function print(tree: Node): string {
  return printTree(tree);
}

export function check(tree: Node, ctx: CheckContext): Result<FType> {
  return capture(() => checkTree(tree, ctx));
}

/** Evaluates a tree. Dice literals produce dice values; nothing is rolled. */
export function evaluate(tree: Node, ctx: EvalContext): Result<Value> {
  return capture(() => evaluateTree(tree, ctx));
}

export function roll(dice: DiceValue, source: FaceSource): Result<RollResult> {
  return capture(() => rollDice(dice, source));
}
