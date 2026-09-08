/**
 * Minnesota boundary + clamp — run with:
 *   npx --yes tsx --test src/map/location/device/minnesotaBounds.test.ts
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAP_CONFIG } from '../../config';
import { clampToMinnesota, isInMinnesota } from './minnesotaBounds';
import { CAPITOL_SPAWN } from '../positionMode/positionConstants';

describe('isInMinnesota', () => {
  it('accepts the Capitol lawn spawn', () => {
    assert.equal(isInMinnesota(CAPITOL_SPAWN.lat, CAPITOL_SPAWN.lng), true);
  });

  it('accepts a point on the bounding-box interior (Minneapolis)', () => {
    assert.equal(isInMinnesota(44.9778, -93.265), true);
  });

  it('rejects a point clearly south of the box (Iowa)', () => {
    assert.equal(isInMinnesota(41.6, -93.6), false);
  });

  it('rejects a point clearly east of the box (Wisconsin interior)', () => {
    assert.equal(isInMinnesota(44.5, -88.0), false);
  });

  it('treats the box edges as inside (inclusive)', () => {
    const b = MAP_CONFIG.MINNESOTA_BOUNDS;
    assert.equal(isInMinnesota(b.south, b.west), true);
    assert.equal(isInMinnesota(b.north, b.east), true);
  });
});

describe('clampToMinnesota', () => {
  it('leaves an in-state point unchanged besides the inset room', () => {
    const next = clampToMinnesota(CAPITOL_SPAWN.lat, CAPITOL_SPAWN.lng);
    assert.equal(next.lat, CAPITOL_SPAWN.lat);
    assert.equal(next.lng, CAPITOL_SPAWN.lng);
  });

  it('clamps an out-of-state point onto the inset box', () => {
    const next = clampToMinnesota(40, -80);
    const b = MAP_CONFIG.MINNESOTA_BOUNDS;
    assert.ok(next.lat > b.south && next.lat < b.north);
    assert.ok(next.lng > b.west && next.lng < b.east);
    assert.equal(isInMinnesota(next.lat, next.lng), true);
  });
});
