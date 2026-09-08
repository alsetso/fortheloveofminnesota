'use client';

/**
 * Lightweight GLB preview canvas — loads a GLB, frames it, and slowly yaws it.
 * Avatars render in their default exported pose (no bone overrides).
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

type Props = {
  url: string;
  className?: string;
  /** Transparent stage for inline chips (Today finds, etc.). Default: dark modal stage. */
  transparent?: boolean;
};

function frameModel(
  model: THREE.Object3D,
  camera: THREE.PerspectiveCamera,
  aspect: number,
): void {
  const yaw = model.rotation.y;
  model.rotation.set(0, 0, 0);
  model.position.set(0, 0, 0);
  model.scale.set(1, 1, 1);
  model.updateWorldMatrix(true, true);

  const box = new THREE.Box3().setFromObject(model);
  if (box.isEmpty()) { model.rotation.y = yaw; return; }

  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);
  model.rotation.y = yaw;
  model.updateWorldMatrix(true, true);

  const fitSize = box.getSize(new THREE.Vector3());
  const height = Math.max(fitSize.y, 0.001);
  const width  = Math.max(fitSize.x, fitSize.z, height * 0.45, 0.001);

  const fov  = THREE.MathUtils.degToRad(camera.fov);
  let dist   = height / 2 / Math.tan(fov / 2);
  dist = Math.max(dist, width / 2 / (Math.tan(fov / 2) * Math.max(aspect, 0.01)));
  dist *= 1.4;

  camera.near = Math.max(dist / 100, 0.01);
  camera.far  = Math.max(dist * 40,  50);
  camera.position.set(0, height * 0.06, dist);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}

function prepareMaterials(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat) continue;
      mat.side = THREE.DoubleSide;
      const m = mat as THREE.MeshStandardMaterial;
      if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
      m.needsUpdate = true;
    }
  });
}

export function WorldModelPreviewCanvas({
  url,
  className = '',
  transparent = false,
}: Props) {
  const hostRef  = useRef<HTMLDivElement>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let raf = 0;
    modelRef.current = null;

    const scene = new THREE.Scene();
    if (!transparent) scene.background = new THREE.Color(0x121214);

    const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 100);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: transparent,
      premultipliedAlpha: transparent,
    });
    if (transparent) renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width   = '100%';
    renderer.domElement.style.height  = '100%';
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(
      0xffffff,
      transparent ? 0xe8d8c8 : 0x2a2a30,
      transparent ? 1.15 : 1.2,
    ));
    const key = new THREE.DirectionalLight(0xffffff, transparent ? 1.55 : 1.6);
    key.position.set(2.2, 3.5, 2.4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(
      transparent ? 0xffd0c8 : 0xb8d4ff,
      transparent ? 0.55 : 0.6,
    );
    fill.position.set(-2.5, 1.2, -1.5);
    scene.add(fill);

    const resize = () => {
      const w = host.clientWidth  || 1;
      const h = host.clientHeight || 1;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      if (modelRef.current) frameModel(modelRef.current, camera, camera.aspect);
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(host);

    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        if (disposed) return;
        const m = gltf.scene;
        prepareMaterials(m);
        scene.add(m);
        modelRef.current = m;
        frameModel(m, camera, camera.aspect);
      },
      undefined,
      () => { /* leave empty stage on load failure */ },
    );

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (modelRef.current) modelRef.current.rotation.y += 0.014;
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      modelRef.current = null;
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
          const mat = mesh.material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat?.dispose?.();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentElement === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, [url, transparent]);

  return (
    <div
      ref={hostRef}
      className={className}
      aria-hidden
      role="presentation"
    />
  );
}
