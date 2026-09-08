# Flight and runways

`/fly` uses the shared iOS shell. Published runway centerlines come from
`atlas.features` in collection `mn_airport_runways`, through
`GET /api/fly/runways?lat=...&lng=...`.

The server calls `atlas.features_in_bbox` for a local window and attaches
recorded width/surface attributes. The client refreshes after 8 km of movement.
Only valid line geometry with a recorded width becomes a landing zone. The
map highlights centerlines in mint; the selected runway is gold. The north-up
radar shows a 30 km radius and lists the nearest eight runway segments.

## Flying

- On first opening `/fly`, the nearest loaded runway is selected automatically.
  Once terrain elevation loads, choose Start takeoff; throttle is already full.
  Hold W/Up to lift off above 68 KT.
- To choose another runway, open Runway radar and choose Line up or Reverse.
- Wait for terrain elevation, press Fly, increase throttle, then hold W/Up
  above 68 KT to take off. Touch controls provide the same inputs.
- L or Arm landing enables descent to the ground. Align within 15 degrees
  of either runway direction; keep bank at or below 10 degrees, speed at
  49-117 KT, and descent at or below 4 m/s. Touchdown must be within the
  green touchdown surface (at least 120 m wide). The corridor extends 1.2 km before
  the threshold and widens outward; touchdown begins at the real threshold. The readout shows AGL, sink, bank and alignment.
- On touchdown, throttle drops to idle. Hold B or the brake button to stop.
- Invalid touchdown triggers an arcade go-around. Ground travel stops at
  the landing surface edge; reset or line up again to recover. Regional departure
  choices still start in the air.

Runway dimensions and coordinates are atlas data. Elevation comes from
Mapbox terrain. This is an arcade simulation; it does not model aerodynamic
stalls, wind, landing permissions, or real-world airport operations.

Flight phases are ground → takeoff → airborne → approach → landing → ground.
Runway selection favors alignment, proximity and inbound direction, with a small
preference for the active runway. Geometry is cached; corridor paint updates only
when eligibility changes. After rollout, accelerate and climb to take off again.

## Tests

Run `flightPhysics.test.ts` with the project's TypeScript test runner, or
compile it with TypeScript to a temporary CommonJS output directory and run
the compiled file with `node --test`. Tests cover real ANE runway geometry,
both directions, takeoff, touchdown gates, off-runway rejection, braking,
runway-edge stops, map bounds, and invalid atlas geometry.

## Compact flight display

Heading and aircraft instruments stay in the shell header, including AGL, sink,
bank and runway alignment. Radar and throttle remain visible in portrait and
landscape. Tap Runways for the existing runway list and lineup actions; the
header options menu contains departure, reset, help and Back to map. Tap the
flight phase for the full status message. Touch flight controls are at least
44 × 44 CSS pixels; the throttle is vertical with full power at the top.

The flight arrows are replaced by a proportional thumb joystick. Drag upward to
climb, downward to descend, and sideways to bank; diagonal input combines both.
A small center dead zone filters jitter. Release, cancel, pause or losing focus
centers the stick. Keyboard controls and the separate brake remain available.
