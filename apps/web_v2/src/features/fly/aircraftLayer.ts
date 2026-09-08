import * as THREE from 'three';
import { MercatorCoordinate, type CustomLayerInterface } from 'mapbox-gl';
import { radians, type FlightState } from './flightPhysics';

/** Aircraft coordinates: +Y nose, +X right wing, +Z up. */
export function createAircraftLayer(getFlight: () => FlightState): CustomLayerInterface {
  const scene = new THREE.Scene();
  const camera = new THREE.Camera();
  const aircraft = new THREE.Group();
  const ivory = new THREE.MeshStandardMaterial({ color: '#f7f5f1', roughness: 0.4, metalness: 0.25 });
  const red = new THREE.MeshStandardMaterial({ color: '#dc5539', roughness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: '#173c4c', metalness: 0.6, roughness: 0.2 });
  function part(geometry: THREE.BufferGeometry, material: THREE.Material, position: [number, number, number], scale: [number, number, number]) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    aircraft.add(mesh);
    return mesh;
  }
  part(new THREE.SphereGeometry(1, 20, 12), ivory, [0, 0, 0], [1.15, 7, 1.05]);
  part(new THREE.SphereGeometry(1, 16, 10), glass, [0, 1.4, 0.8], [0.85, 2.2, 0.7]);
  part(new THREE.BoxGeometry(1, 1, 1), ivory, [0, 0.2, 0.25], [19, 2.2, 0.2]);
  part(new THREE.BoxGeometry(1, 1, 1), red, [-8.7, 0.2, 0.26], [1.5, 2.2, 0.22]);
  part(new THREE.BoxGeometry(1, 1, 1), red, [8.7, 0.2, 0.26], [1.5, 2.2, 0.22]);
  part(new THREE.BoxGeometry(1, 1, 1), red, [0, -5.2, 0.5], [6.3, 1.5, 0.18]);
  part(new THREE.BoxGeometry(1, 1, 1), red, [0, -5.1, 1.5], [0.18, 2, 2.4]);
  const propeller = part(new THREE.BoxGeometry(1, 1, 1), glass, [0, 7, 0], [0.18, 0.12, 3.5]);
  for (const [x, y] of [[-1.4, 0], [1.4, 0], [0, 4]]) {
    part(new THREE.BoxGeometry(1, 1, 1), ivory, [x, y, -1.2], [0.12, 0.12, 1]);
    part(new THREE.SphereGeometry(1, 12, 8), glass, [x, y, -1.7], [0.15, 0.3, 0.3]);
  }
  scene.add(aircraft, new THREE.HemisphereLight(0xffffff, 0x668078, 2.4));
  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.position.set(-30, 20, 60);
  scene.add(sun);
  let renderer: THREE.WebGLRenderer | null = null;
  return {
    id: 'fly-aircraft', type: 'custom', renderingMode: '3d',
    onAdd(map, gl) {
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
    },
    render(_gl, matrix) {
      if (!renderer) return;
      const flight = getFlight();
      const origin = MercatorCoordinate.fromLngLat([flight.lng, flight.lat], flight.altitude);
      const scale = origin.meterInMercatorCoordinateUnits();
      const transform = new THREE.Matrix4().makeTranslation(origin.x, origin.y, origin.z)
        .scale(new THREE.Vector3(scale, -scale, scale));
      aircraft.rotation.set(radians(flight.pitch), radians(flight.bank), -radians(flight.heading), 'ZXY');
      propeller.rotation.y = performance.now() / 35;
      camera.projectionMatrix.fromArray(matrix).multiply(transform);
      renderer.resetState();
      renderer.render(scene, camera);
    },
    onRemove() {
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) object.geometry.dispose();
      });
      ivory.dispose(); red.dispose(); glass.dispose();
      renderer?.dispose();
      renderer = null;
    },
  };
}
