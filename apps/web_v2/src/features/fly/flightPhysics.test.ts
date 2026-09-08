import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFlight, createRunwayFlight, offsetPosition, stepFlight, type FlightState } from './flightPhysics';
import { parseRunways, runwayPosition } from './runways';

// Published ANE 09/27 centerline and width, read from atlas.features.
const [runway] = parseRunways({ type: 'FeatureCollection', features: [{
  type: 'Feature', id: 'ane-09-27', properties: { name: 'ANE Runway 09/27', attrs: { runway_width_ft: 100, surface_type: 'Asph-G' } },
  geometry: { type: 'LineString', coordinates: [[-93.22008, 45.14483], [-93.20071, 45.14466]] },
}] });
const ground = 280;
const idle = { throttle: 0, turn: 0, climb: 0 };
function approach(overrides: Partial<FlightState> = {}): FlightState {
  const spawn = createRunwayFlight(runway, ground);
  const position = offsetPosition(spawn.lng, spawn.lat, spawn.heading, 300);
  return { ...spawn, ...position, phase: 'airborne', speed: 40, altitude: ground + 2.01, pitch: -2, landingArmed: true, ...overrides };
}

test('real runway geometry yields a measured length, width and heading', () => {
  assert.ok(runway.length > 1400 && runway.length < 1600);
  assert.equal(runway.width, 30.48);
  assert.ok(runway.heading > 89 && runway.heading < 92);
});
test('both departure directions start inside the runway at rest', () => {
  for (const reverse of [false, true]) {
    const state = createRunwayFlight(runway, ground, reverse);
    assert.ok(runwayPosition(runway, [state.lng, state.lat]).distance < 1);
    assert.equal(state.speed, 0);
    assert.equal(state.altitude, ground + 2);
  }
});
test('a controlled runway approach touches down', () => {
  assert.equal(stepFlight(approach(), idle, 0.05, ground, [runway]).phase, 'ground');
});
test('reciprocal heading permits landing', () => {
  const state = approach({ heading: (runway.heading + 180) % 360 });
  assert.equal(stepFlight(state, idle, 0.05, ground, [runway]).phase, 'ground');
});
test('misaligned, overspeed, steep and banked approaches go around', () => {
  for (const overrides of [{ heading: runway.heading + 40 }, { speed: 80 }, { pitch: -20 }, { bank: 30 }]) {
    const next = stepFlight(approach(overrides), idle, 0.05, ground, [runway]);
    assert.equal(next.phase, 'airborne');
    assert.equal(next.landingArmed, false);
    assert.match(next.message, /Go around/);
  }
});
test('off-runway contact never counts as landing', () => {
  const next = stepFlight(approach({ lng: -93.3 }), idle, 0.05, ground, [runway]);
  assert.equal(next.phase, 'airborne');
  assert.match(next.message, /inside a highlighted runway/);
});
test('ground acceleration and climb input achieve takeoff in either direction', () => {
  for (const reverse of [false, true]) {
    let state = createRunwayFlight(runway, ground, reverse);
    for (let i = 0; i < 240 && String(state.phase) !== 'airborne'; i++) {
      state = stepFlight(state, { throttle: 1, turn: 0, climb: 1 }, 0.05, ground, [runway]);
    }
    assert.equal(state.phase, 'airborne');
    assert.ok(state.altitude > ground + 2);
  }
});
test('braking stops rollout and does not reverse the plane', () => {
  let state = { ...approach(), phase: 'ground' as const, pitch: 0 } as FlightState;
  for (let i = 0; i < 150; i++) state = stepFlight(state, { ...idle, brake: true }, 0.05, ground, [runway]);
  assert.equal(state.speed, 0);
  assert.equal(state.phase, 'ground');
});
test('runway edge stops ground travel', () => {
  const state = { ...createRunwayFlight(runway, ground), lng: -93.3, speed: 40 };
  const next = stepFlight(state, { ...idle, throttle: 1 }, 0.05, ground, [runway]);
  assert.equal(next.speed, 0);
  assert.match(next.message, /Runway edge/);
});
test('large frame delays cannot teleport or escape Minnesota bounds', () => {
  const state = { ...createFlight(), lng: -89.52001, heading: 90, speed: 220 };
  const next = stepFlight(state, { ...idle, throttle: 1 }, 300);
  assert.ok(next.lng <= -89.52);
  assert.ok(next.distance < 12);
  assert.equal(next.boundary, true);
});
test('point-only features and runways without a measured width are rejected', () => {
  assert.equal(parseRunways({ type: 'FeatureCollection', features: [
    { type: 'Feature', properties: { attrs: { runway_width_ft: 100 } }, geometry: { type: 'Point', coordinates: [-93, 45] } },
    { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: runway.coordinates } },
  ] }).length, 0);
});

test('forgiving touchdown outside physical width supports rollout and another takeoff', () => {
  for (const reverse of [false, true]) {
    const spawn = createRunwayFlight(runway, ground, reverse);
    const center = offsetPosition(spawn.lng, spawn.lat, spawn.heading, 300);
    const side = offsetPosition(center.lng, center.lat, spawn.heading + 90, 45);
    let state: FlightState = { ...spawn, ...side, phase: 'airborne', speed: 40, pitch: -2, altitude: ground + 2.01, landingArmed: true };
    assert.ok(runwayPosition(runway, [state.lng, state.lat]).distance > runway.width / 2);
    state = stepFlight(state, idle, 0.05, ground, [runway]);
    assert.equal(state.phase, 'ground');
    for (let i = 0; i < 80; i++) state = stepFlight(state, { ...idle, brake: true }, 0.05, ground, [runway]);
    assert.equal(state.speed, 0);
    const phases = new Set([state.phase]);
    for (let i = 0; i < 240 && String(state.phase) !== 'airborne'; i++) {
      state = stepFlight(state, { throttle: 1, turn: 0, climb: 1 }, 0.05, ground, [runway]);
      phases.add(state.phase);
    }
    assert.ok(phases.has('takeoff'));
    assert.equal(state.phase, 'airborne');
  }
});

test('approach and landing phases retain airborne movement and abort on climb', () => {
  let state = approach({ altitude: ground + 30 });
  state = stepFlight(state, idle, 0.05, ground, [runway]);
  assert.equal(state.phase, 'approach');
  assert.ok(state.altitude > ground + 20);
  assert.equal(state.activeRunwayId, runway.id);
  state = stepFlight({ ...state, altitude: ground + 15 }, idle, 0.05, ground, [runway]);
  assert.equal(state.phase, 'landing');
  state = stepFlight(state, { ...idle, climb: 1 }, 0.05, ground, [runway]);
  assert.equal(state.phase, 'airborne');
  assert.equal(state.activeRunwayId, undefined);
});

test('corridor permits inbound approaches but rejects outbound extension and premature touchdown', () => {
  const start = runway.coordinates[0];
  const before = offsetPosition(start[0], start[1], runway.heading, -500);
  const inbound = approach({ ...before, altitude: ground + 50 });
  assert.equal(stepFlight(inbound, idle, 0.05, ground, [runway]).phase, 'approach');
  assert.equal(stepFlight({ ...inbound, heading: (runway.heading + 180) % 360 }, idle, 0.05, ground, [runway]).activeRunwayId, undefined);
  assert.equal(stepFlight({ ...inbound, altitude: ground + 2.01 }, idle, 0.05, ground, [runway]).phase, 'airborne');
});

test('aligned runway wins over an intersecting misaligned runway regardless of list order', () => {
  const other = { ...runway, id: 'crossing', coordinates: [offsetPosition(-93.216, 45.1448, 0, -700), offsetPosition(-93.216, 45.1448, 0, 700)].map((p): [number, number] => [p.lng, p.lat]) };
  for (const list of [[other, runway], [runway, other]]) {
    assert.equal(stepFlight(approach({ altitude: ground + 30 }), idle, 0.05, ground, list).activeRunwayId, runway.id);
  }
});

test('sideways ground movement cannot take off', () => {
  const state = { ...createRunwayFlight(runway, ground), heading: runway.heading + 70, speed: 40 };
  assert.equal(stepFlight(state, { throttle: 1, turn: 0, climb: 1 }, 0.05, ground, [runway]).phase, 'ground');
});

test('continuous takeoff, descent, touchdown and second takeoff without resetting position', () => {
  for (const reverse of [false, true]) {
    let state = createRunwayFlight(runway, ground, reverse);
    const phases: string[] = [state.phase];
    const step = (input: typeof idle) => {
      state = stepFlight(state, input, 0.05, ground, [runway]);
      if (phases[phases.length - 1] !== state.phase) phases.push(state.phase);
    };
    for (let i = 0; i < 240 && String(state.phase) !== 'airborne'; i++) step({ throttle: 1, turn: 0, climb: 1 });
    for (let i = 0; i < 150; i++) step({ throttle: 0.08, turn: 0, climb: 0.2 });
    for (let i = 0; i < 600 && state.phase !== 'ground'; i++) step({ throttle: 0.08, turn: 0, climb: -0.15 });
    assert.equal(state.phase, 'ground');
    for (let i = 0; i < 240 && String(state.phase) !== 'airborne'; i++) step({ throttle: 1, turn: 0, climb: 1 });
    assert.deepEqual(phases, ['ground', 'takeoff', 'airborne', 'approach', 'landing', 'ground', 'takeoff', 'airborne']);
  }
});
