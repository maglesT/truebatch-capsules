import { describe, expect, it } from 'vitest';
import { BLOCKS } from '../shared/blocks/index.js';
import { masterChecks } from '../shared/master/checks.js';
import { small, unplaced } from './engine-fixture.js';

// Port of Tablets round 37: a repeat-until step whose stop check reads an optional setting ("$name?") the master left
// unset never passes (the setting is left out at run time), so its rounds end only at the most allowed.

const optionalOfStop = () => BLOCKS.filter((b) => b.stop).flatMap((b) => {
  const c = b.calcs.find((x) => x.name === b.stop)!;
  return [...JSON.stringify(c.args).matchAll(/"\$([a-zA-Z0-9]+)\?"/g)].map((m) => m[1]!).filter((n) => b.settings.some((s) => s.name === n)).map((n) => `${b.id}.${n}`);
});

describe('a stop check reading an optional setting', () => {
  it('the blocks whose stop check reads an optional setting (guard: a new one is looked at)', () => {
    expect(optionalOfStop()).toEqual([]);
  });

  const errors = (settings: Record<string, unknown>, stop = 'carr') => unplaced(masterChecks(small([{ steps: [{ block: { id: 'density-flow', version: 1 }, settings,
    flow: { kind: 'repeat-until', maxRounds: 5, stop } }] }]))).filter((p) => p.level === 'error').map((p) => p.message);
  const LIMIT = { low: '0', high: '15', unit: '%' };

  it('the master refuses a stop check whose optional setting is not set', () => {
    expect(errors({})).toContain('Carr index stops the rounds, but Carr index limits is not set, so it never passes: set it, or pick the check that stops the rounds under More options');
  });

  it('set, it passes; an optional setting of another calculation may stay unset', () => {
    expect(errors({ carrLimit: LIMIT }).filter((m) => m.includes('stops the rounds'))).toEqual([]);
    expect(errors({ carrLimit: LIMIT }).filter((m) => /Hausner|repose/.test(m))).toEqual([]);
  });
});
