import { describe, expect, it } from 'vitest';
import { BLOCKS } from '../shared/blocks/index.js';
import { masterChecks } from '../shared/master/checks.js';
import { small, unplaced } from './engine-fixture.js';

// Port of Tablets rounds 37 and 37b: a repeat-until step whose stop check is a limit check (C1) on an optional setting
// ("$name?") the master left unset never passes (the engine leaves such a C1 out), so its rounds end only at the most
// allowed. Other templates run without the optional value and can pass.

const optionalOfC1 = () => BLOCKS.flatMap((b) => b.calcs.filter((c) => c.template === 'C1').flatMap((c) => {
  const a = c.args as { value?: unknown; limit?: unknown };
  return [...JSON.stringify({ value: a.value, limit: a.limit }).matchAll(/"\$([a-zA-Z0-9]+)\?"/g)].map((m) => `${b.id}.${c.name}.${m[1]}`);
}));

describe('a stop check reading an optional setting', () => {
  it('guard: no shipped limit check (C1) has an optional value or limit', () => {
    expect(optionalOfC1()).toEqual([]);
  });

  it('another template (Carr index, T6) as the stop check, its optional limit unset: not refused (it runs without it)', () => {
    const errors = unplaced(masterChecks(small([{ steps: [{ block: { id: 'density-flow', version: 1 }, settings: {},
      flow: { kind: 'repeat-until', maxRounds: 5, stop: 'carr' } }] }]))).filter((p) => p.level === 'error').map((p) => p.message);
    expect(errors.filter((m) => m.includes('stops the rounds'))).toEqual([]);
  });
});
