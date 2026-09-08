import { MAP_CONFIG } from '../../map/config';
import { bearing, landingPosition, type Runway } from './runways';

export const FLIGHT_LOCATIONS = [
  { name: 'Twin Cities', lng: -93.265, lat: 44.9778, heading: 35 },
  { name: 'Duluth', lng: -92.1, lat: 46.7867, heading: 65 },
  { name: 'North Shore', lng: -90.334, lat: 47.751, heading: 235 },
  { name: 'Bemidji', lng: -94.88, lat: 47.4736, heading: 90 },
  { name: 'Rochester', lng: -92.463, lat: 44.0121, heading: 330 },
] as const;

export type FlightState = {
  lng: number; lat: number; altitude: number; heading: number;
  bank: number; pitch: number; speed: number; distance: number; boundary: boolean;
  phase: 'ground' | 'takeoff' | 'airborne' | 'approach' | 'landing';
  activeRunwayId?: string; runwayReverse?: boolean; landingArmed: boolean; message: string;
};
export const isGrounded = (state: FlightState) => state.phase === 'ground' || state.phase === 'takeoff';
export type FlightInput = { turn: number; climb: number; throttle: number; brake?: boolean };
export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export const radians = (degrees: number) => degrees * Math.PI / 180;

export function createFlight(index = 0): FlightState {
  return { ...FLIGHT_LOCATIONS[index], altitude: 950, bank: 0, pitch: 0, speed: 85, distance: 0, boundary: false, phase: 'airborne', landingArmed: false, message: '' };
}

export function createRunwayFlight(runway: Runway, ground: number, reverse = false): FlightState {
  const points = reverse ? [...runway.coordinates].reverse() : runway.coordinates;
  const heading = bearing(points[0], points[1]);
  const start = offsetPosition(points[0][0], points[0][1], heading, 30);
  return { ...createFlight(), ...start, heading, altitude: ground + 2, speed: 0, phase: 'ground', message: 'Ready for takeoff. Full throttle, then climb above 68 KT.' };
}

export function offsetPosition(lng: number, lat: number, heading: number, meters: number) {
  return {
    lng: lng + Math.sin(radians(heading)) * meters / (111320 * Math.cos(radians(lat))),
    lat: lat + Math.cos(radians(heading)) * meters / 111320,
  };
}

/** Arcade flight in meters/seconds; dt is capped so background tabs cannot teleport. */
export function stepFlight(state: FlightState, input: FlightInput, seconds: number, ground = 0, runways: Runway[] = []): FlightState {
  const dt = clamp(seconds, 0, 0.05);
  const blend = 1 - Math.exp(-3 * dt);
  const grounded = isGrounded(state);
  const bank = grounded ? 0 : state.bank + (clamp(input.turn, -1, 1) * 38 - state.bank) * blend;
  const pitch = state.pitch + (clamp(input.climb, -1, 1) * 22 - state.pitch) * blend;
  let heading = (state.heading + (grounded ? input.turn * 10 : bank * 0.62) * dt + 360) % 360;
  const targetSpeed = grounded ? input.throttle * 100 : 25 + clamp(input.throttle, 0, 1) * 195;
  const speed = clamp(state.speed + clamp(targetSpeed - state.speed, -12, grounded ? 5 : 12) * dt - (input.brake && grounded ? 15 * dt : 0), 0, 220);
  const distance = speed * Math.cos(radians(pitch)) * dt;
  const next = offsetPosition(state.lng, state.lat, heading, distance);
  const b = MAP_CONFIG.MINNESOTA_BOUNDS;
  // Leave camera room inside maxBounds and reflect course on contact with an edge.
  const lng = clamp(next.lng, b.west + 0.02, b.east - 0.02);
  const lat = clamp(next.lat, b.south + 0.02, b.north - 0.02);
  const boundary = lng !== next.lng || lat !== next.lat;
  if (lng !== next.lng) heading = (360 - heading) % 360;
  if (lat !== next.lat) heading = (180 - heading + 360) % 360;
  const result: FlightState = {
    ...state,
    lng, lat, heading, bank: boundary ? 0 : bank, pitch, speed,
    altitude: grounded ? ground + 2 : clamp(state.altitude + speed * Math.sin(radians(pitch)) * dt, state.landingArmed ? ground + 2 : Math.max(150, ground + 100), 5500),
    distance: state.distance + distance, boundary,
  };
  // Cheap axis projections over the already loaded local runway list; no queries.
  let candidate: { runway: Runway; position: ReturnType<typeof landingPosition>; score: number } | undefined;
  for (const runway of runways) {
    const position = landingPosition(runway, [lng, lat], heading);
    if (!(grounded ? position.touchdown : position.inside) || position.error > (grounded ? 25 : 20)) continue;
    const score = position.cross + Math.max(0, -position.along) * 0.05 + position.error * 12
      - (state.activeRunwayId === runway.id ? 20 : 0);
    if (!candidate || score < candidate.score) candidate = { runway, position, score };
  }
  result.activeRunwayId = undefined;
  result.runwayReverse = undefined;
  if (grounded) {
    if (!candidate) return { ...state, heading, phase: 'ground', speed: 0, activeRunwayId: undefined, message: 'Runway edge or alignment limit reached. Steer toward the runway or line up again.' };
    result.activeRunwayId = candidate.runway.id;
    result.runwayReverse = candidate.position.reverse;
    if (state.phase === 'takeoff' && speed >= 35 && input.climb > 0 && !input.brake && candidate.position.error <= 15) {
      return { ...result, phase: 'airborne', altitude: ground + 3, landingArmed: true, message: 'Liftoff! Climb away from the runway.' };
    }
    return { ...result, phase: speed > 3 && input.throttle > 0 && !input.brake ? 'takeoff' : 'ground', pitch: 0 };
  }
  const sink = -speed * Math.sin(radians(pitch));
  const validApproach = state.landingArmed && candidate && result.altitude - ground <= 250
    && pitch <= 0 && speed >= 25 && speed <= 60 && Math.abs(bank) <= 10 && sink <= 4 && Math.abs(pitch) <= 12;
  result.phase = 'airborne';
  if (validApproach && candidate) {
    result.activeRunwayId = candidate.runway.id;
    result.runwayReverse = candidate.position.reverse;
    result.phase = result.altitude - ground <= 20 ? 'landing' : 'approach';
    result.message = `${result.phase === 'landing' ? 'Landing' : 'Approach'}: ${candidate.runway.name}. Follow the green corridor; touch down alongside the runway.`;
  } else if (state.phase === 'approach' || state.phase === 'landing') {
    result.message = 'Approach lost. Align with a runway and descend gently, or climb to go around.';
  }
  if (state.landingArmed && result.altitude <= ground + 2 && pitch <= 0) {
    if (validApproach && candidate && candidate.position.touchdown && candidate.position.error <= 15) {
      return { ...result, phase: 'ground', pitch: 0, bank: 0, landingArmed: false, message: `Touchdown on ${candidate.runway.name}. Hold brakes to stop, or accelerate for takeoff.` };
    }
    return { ...result, phase: 'airborne', activeRunwayId: undefined, altitude: ground + 40, pitch: 8, speed: Math.max(speed, 50), landingArmed: false,
      message: candidate ? 'Go around: align within 15 degrees and reach the runway before touchdown.' : 'Go around: touchdown must be inside a highlighted runway landing surface.' };
  }
  return result;
}
