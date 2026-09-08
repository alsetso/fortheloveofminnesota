/**
 * Free Mode speed scaling — run with:
 *   npx --yes tsx --test src/map/location/positionMode/positionConstants.test.ts
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FREE_MOVE_MAX_MPS,
  FREE_MOVE_REF_ZOOM,
  FREE_MOVE_SPEED_MPS,
  freeMoveSpeedMpsForZoom,
} from './positionConstants';

describe('freeMoveSpeedMpsForZoom', () => {
  it('returns the named speed at the reference zoom', () => {
    assert.equal(freeMoveSpeedMpsForZoom(FREE_MOVE_REF_ZOOM), FREE_MOVE_SPEED_MPS);
  });

  it('doubles ground speed when zoomed out one level', () => {
    assert.equal(
      freeMoveSpeedMpsForZoom(FREE_MOVE_REF_ZOOM - 1),
      FREE_MOVE_SPEED_MPS * 2,
    );
  });

  it('never exceeds the safety cap', () => {
    assert.equal(freeMoveSpeedMpsForZoom(1), FREE_MOVE_MAX_MPS);
  });

  it('never drops below a quarter of the named speed', () => {
    assert.equal(freeMoveSpeedMpsForZoom(24), FREE_MOVE_SPEED_MPS * 0.25);
  });
});
