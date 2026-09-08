/**
 * Pure physics tests for dockGesture — run with:
 *   npx --yes tsx --test src/features/map/explore/dockGesture.test.ts
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createVelocityTracker,
  pickSnapDetent,
  resolveDockCardRelease,
} from './dockGesture';

const DETENTS = [
  ['full', 40],
  ['half', 400],
  ['quarter', 700],
  ['collapsed', 800],
] as const;

const SOFT = 0.2;
const COMPLETE = 0.5;

describe('createVelocityTracker', () => {
  it('smooths successive samples toward the latest instantaneous velocity', () => {
    const tracker = createVelocityTracker(0);
    tracker.addSample(10, 10);
    tracker.addSample(20, 20);
    assert.ok(tracker.value > 1);
    assert.ok(tracker.value < 2.1);
  });
});

describe('down from full — soft vs complete', () => {
  it('soft flick from full lands on half (not collapsed)', () => {
    assert.equal(pickSnapDetent(DETENTS, 80, SOFT, 40), 'half');
  });

  it('complete flick from full skips to collapsed', () => {
    assert.equal(pickSnapDetent(DETENTS, 80, COMPLETE, 40), 'collapsed');
  });

  it('soft pull past midpoint to half lands on half', () => {
    assert.equal(pickSnapDetent(DETENTS, 220, 0, 40), 'half');
  });

  it('pull past half detent is a complete scroll → collapsed', () => {
    assert.equal(pickSnapDetent(DETENTS, 460, 0, 40), 'collapsed');
  });

  it('opening to full still sticks against reverse lift-off noise', () => {
    assert.equal(pickSnapDetent(DETENTS, 50, 0.3, 400), 'full');
  });
});

describe('card down from full — soft vs complete', () => {
  const half = 400;
  const full = 40;

  it('soft flick from full → half', () => {
    assert.equal(resolveDockCardRelease(80, SOFT, half, full, full), 'half');
  });

  it('complete flick from full → close', () => {
    assert.equal(resolveDockCardRelease(80, COMPLETE, half, full, full), 'close');
  });

  it('pull past half from full → close', () => {
    assert.equal(resolveDockCardRelease(460, 0, half, full, full), 'close');
  });

  it('soft pull toward half from full → half', () => {
    assert.equal(resolveDockCardRelease(220, 0, half, full, full), 'half');
  });

  it('upward flick from half → full sticks', () => {
    assert.equal(resolveDockCardRelease(380, -SOFT, half, full, half), 'full');
  });
});
