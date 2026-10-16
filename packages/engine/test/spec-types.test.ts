import type {
  ActionResult as SpecActionResult,
  ApplyChangesInput,
  ApplyChangesOutput,
  CharacterFile,
  ComputeSheetOutput,
  ContinueActionInput,
  EngineFailure,
  ListOptionsInput,
  ListOptionsOutput,
  StartActionInput,
  UpgradeOutput,
} from '@opencharacter/spec';
import { describe, expect, it } from 'vitest';
import type {
  applyChanges,
  computeSheet,
  continueAction,
  listOptions,
  loadRuleset,
  startAction,
  upgrade,
} from '../src/index.ts';

// The engine's calls against the types generated from the spec's schemas: every output
// must be a valid spec output, and every valid spec input must be accepted. `pnpm typecheck`
// checks these; a failure means the engine and a schema disagree.

type Assert<T extends true> = T;
type Extends<A, B> = [A] extends [B] ? true : false;

type Outputs = [
  Assert<Extends<ReturnType<typeof computeSheet>, ComputeSheetOutput>>,
  Assert<Extends<ReturnType<typeof listOptions>, ListOptionsOutput>>,
  Assert<Extends<ReturnType<typeof applyChanges>, ApplyChangesOutput>>,
  Assert<Extends<ReturnType<typeof startAction>, SpecActionResult>>,
  Assert<Extends<ReturnType<typeof continueAction>, SpecActionResult>>,
  Assert<Extends<ReturnType<typeof upgrade>, UpgradeOutput>>,
  Assert<Extends<Extract<ReturnType<typeof loadRuleset>, { ok: false }>, EngineFailure>>,
];

type Paused = Extract<SpecActionResult, { status: 'paused' }>;

type Inputs = [
  Assert<Extends<CharacterFile, Parameters<typeof computeSheet>[1]>>,
  Assert<Extends<ListOptionsInput['choice'], Parameters<typeof listOptions>[2]>>,
  Assert<Extends<ApplyChangesInput['changes'], Parameters<typeof applyChanges>[2]>>,
  Assert<
    Extends<Omit<StartActionInput, 'ruleset' | 'character'>, Parameters<typeof startAction>[2]>
  >,
  Assert<Extends<Paused, Parameters<typeof continueAction>[1]>>,
  Assert<Extends<ContinueActionInput['answer'], Parameters<typeof continueAction>[2]>>,
  Assert<Extends<ContinueActionInput['policy'], Parameters<typeof continueAction>[3]>>,
];

describe('engine calls and the spec types', () => {
  it('are checked by the type checker', () => {
    const checked: [Outputs, Inputs] | undefined = undefined;
    expect(checked).toBeUndefined();
  });
});
