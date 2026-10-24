import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  type ActionAnswer,
  type ActionResult,
  continueAction,
  diceFrom,
  loadRuleset,
  startAction,
} from '../src/index.ts';
import { readPack } from './packs.ts';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const loaded = loadRuleset([readPack(`${root}packs/mothership/1e`)]);
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const ruleset = loaded.ruleset;
const blank = {
  specVersion: '0.1.0',
  id: 'test',
  packs: [{ id: 'mothership-1e', version: '0.1.1' }],
  creating: true,
};
const input = {
  action: { id: 'mothership-1e:roll-character' },
  policy: { dice: 'pause', choices: 'pause', allocations: 'pause' } as const,
};

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

/** Answers every pause of the creation start in turn: seeded faces, the recommended option. */
function walk(): { answers: ActionAnswer[]; results: ActionResult[] } {
  const next = seeded(84);
  const answers: ActionAnswer[] = [];
  let result = startAction(ruleset, blank, input);
  const results = [result];
  while ('status' in result && result.status === 'paused' && answers.length < 100) {
    const { needs } = result;
    let answer: ActionAnswer;
    if (needs.kind === 'dice')
      answer = {
        faces: (needs.dice ?? []).flatMap((d) =>
          Array.from({ length: d.count }, () =>
            d.sides === 'F'
              ? Math.floor(next() * 3) - 1
              : Math.floor(next() * d.sides) + (d.zero ? 0 : 1),
          ),
        ),
      };
    else if (needs.kind === 'choice')
      answer = { option: needs.recommended ?? (needs.options?.[0] as string) };
    else throw new Error(`unexpected pause ${needs.kind}`);
    answers.push(answer);
    result = continueAction(ruleset, result, answer, input.policy);
    results.push(result);
  }
  return { answers, results };
}

describe('replay from answers', () => {
  const { answers, results } = walk();

  it('walks the Mothership creation start through several pauses to the end', () => {
    expect(answers.length).toBeGreaterThan(5);
    expect(results.at(-1)).toMatchObject({ status: 'finished' });
  });

  it('gives the loop result for every count of answers', () => {
    for (let k = 0; k <= answers.length; k++) {
      const replayed = startAction(ruleset, blank, { ...input, answers: answers.slice(0, k) });
      expect(replayed, `after ${k} answers`).toEqual(results[k]);
    }
  });

  it('leaves a paused result continueAction can carry on', () => {
    const k = Math.floor(answers.length / 2);
    const paused = startAction(ruleset, blank, { ...input, answers: answers.slice(0, k) });
    if (!('status' in paused) || paused.status !== 'paused') throw new Error('not paused');
    expect(continueAction(ruleset, paused, answers[k] as ActionAnswer, input.policy)).toEqual(
      results[k + 1],
    );
  });

  it('fails at the first answer that does not fit, with its index and the pause', () => {
    const i = answers.findIndex((a, j) => j > 0 && a.faces !== undefined);
    const bad = answers.map((a, j) => (j === i ? { faces: [0] } : a));
    const replayed = startAction(ruleset, blank, { ...input, answers: bad });
    const paused = results[i] as { needs: unknown };
    expect(replayed).toEqual({
      ok: false,
      errors: [
        {
          code: 'answer-mismatch',
          data: { reason: expect.any(String), index: i, needs: paused.needs },
        },
      ],
    });
  });

  it('fails on an answer left over once the action finishes', () => {
    const replayed = startAction(ruleset, blank, {
      ...input,
      answers: [...answers, { option: 'extra' }],
    });
    expect(replayed).toMatchObject({
      ok: false,
      errors: [{ code: 'answer-mismatch', data: { index: answers.length } }],
    });
    expect((replayed as { errors: { data: object }[] }).errors[0]?.data).not.toHaveProperty(
      'needs',
    );
  });

  it('asks the dice function only for checkpoints the policy runs itself', () => {
    // Choices paused, dice automatic: the answers are the options; the faces come from the
    // dice function, in the same order as the loop asks for them.
    const auto = { action: input.action, policy: { choices: 'pause' } as const };
    const faces = Array.from({ length: 40 }, (_, j) => (j % 2) + 1);
    const dice = diceFrom(faces);
    let loop = startAction(ruleset, blank, auto, dice);
    const options: ActionAnswer[] = [];
    while ('status' in loop && loop.status === 'paused') {
      const option = { option: loop.needs.recommended ?? (loop.needs.options?.[0] as string) };
      options.push(option);
      loop = continueAction(ruleset, loop, option, auto.policy, dice);
    }
    expect(options.length).toBeGreaterThan(0);
    expect(startAction(ruleset, blank, { ...auto, answers: options }, diceFrom(faces))).toEqual(
      loop,
    );
  });
});
