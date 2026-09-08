/**
 * resolvePresenceMode decision table — run with:
 *   npx --yes tsx --test src/map/location/positionMode/resolvePositionMode.test.ts
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CAPITOL_SPAWN } from './positionConstants';
import { resolvePresenceMode, scoutNoticeFor } from './resolvePositionMode';

describe('resolvePresenceMode', () => {
  it('request scout is always Scout at the current pose when in-state', async () => {
    const pose = { lat: 44.98, lng: -93.27 };
    const resolved = await resolvePresenceMode({
      request: 'scout',
      currentPose: pose,
    });
    assert.equal(resolved.mode, 'scout');
    assert.equal(resolved.scoutReason, 'preferred');
    assert.deepEqual(resolved.coords, pose);
  });

  it('spawn capitol ignores pose and persist — Campaign respawn', async () => {
    const resolved = await resolvePresenceMode({
      request: 'scout',
      spawn: 'capitol',
      currentPose: { lat: 44.98, lng: -93.27 },
    });
    assert.equal(resolved.mode, 'scout');
    assert.deepEqual(resolved.coords, {
      lat: CAPITOL_SPAWN.lat,
      lng: CAPITOL_SPAWN.lng,
    });
  });

  it('request scout falls back to the Capitol when pose is out of state', async () => {
    const resolved = await resolvePresenceMode({
      request: 'scout',
      currentPose: { lat: 41.6, lng: -93.6 },
    });
    assert.equal(resolved.mode, 'scout');
    assert.deepEqual(resolved.coords, {
      lat: CAPITOL_SPAWN.lat,
      lng: CAPITOL_SPAWN.lng,
    });
  });
});

describe('scoutNoticeFor', () => {
  it('returns one message per fall-through reason and null for preferred', () => {
    assert.equal(scoutNoticeFor('preferred'), null);
    assert.equal(scoutNoticeFor(undefined), null);
    assert.match(scoutNoticeFor('permission') ?? '', /Scout mode/i);
    assert.match(scoutNoticeFor('geolocation-failed') ?? '', /Scout mode/i);
    assert.match(scoutNoticeFor('outside-minnesota') ?? '', /outside Minnesota/i);
  });
});
