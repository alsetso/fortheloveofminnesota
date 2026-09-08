'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const HEART_URL = '/models/props/heart-quaternius.glb';

type SpinningHeartCanvasProps = {
  className?: string;
  style?: CSSProperties;
};

/**
 * Lightweight Three.js canvas that loads the heart GLB and spins it with a
 * gentle sine-wave bob. Uses a ResizeObserver to defer initialisation until
 * the host element has real layout dimensions — safe to use at any render
 * phase including the cold-start splash screen.
 */
export default function SpinningHeartCanvas({ className = '', style }: SpinningHeartCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let raf = 0;
    let model: THREE.Object3D | null = null;
    let renderer: THREE.WebGLRenderer | null = null;
    let camera: THREE.PerspectiveCamera | null = null;
    let scene: THREE.Scene | null = null;
    let tick = 0;

    function init(w: number, h: number) {
      if (disposed) return;

      scene = new THREE.Scene();

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setSize(w, h, false);
      renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;';
      // host is guaranteed non-null (guarded at useEffect entry, const binding).
      host!.appendChild(renderer.domElement);

      camera = new THREE.PerspectiveCamera(34, w / h, 0.01, 100);

      scene.add(new THREE.HemisphereLight(0xffe8e0, 0x1a0808, 1.4));
      const key = new THREE.DirectionalLight(0xffffff, 1.8);
      key.position.set(2, 3.5, 2.5);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0xff6060, 0.9);
      rim.position.set(-2, 1, -2);
      scene.add(rim);

      const loader = new GLTFLoader();
      loader.load(
        HEART_URL,
        (gltf) => {
          if (disposed || !scene || !camera) return;
          const m = gltf.scene;
          m.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            if (!mesh.isMesh) return;
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const mat of mats) {
              if (!mat) continue;
              mat.side = THREE.DoubleSide;
              const s = mat as THREE.MeshStandardMaterial;
              if (s.map) s.map.colorSpace = THREE.SRGBColorSpace;
              s.needsUpdate = true;
            }
          });
          scene.add(m);
          model = m;

          const box = new THREE.Box3().setFromObject(m);
          const center = box.getCenter(new THREE.Vector3());
          m.position.sub(center);
          m.updateWorldMatrix(true, true);

          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z, 0.001);
          const fov = THREE.MathUtils.degToRad(camera.fov);
          const dist = (maxDim / 2 / Math.tan(fov / 2)) * 1.5;
          camera.near = dist / 100;
          camera.far  = dist * 40;
          camera.position.set(0, size.y * 0.05, dist);
          camera.lookAt(0, 0, 0);
          camera.updateProjectionMatrix();
        },
        undefined,
        () => { /* silent on load error */ },
      );

      const animate = () => {
        raf = requestAnimationFrame(animate);
        tick++;
        if (model) {
          model.rotation.y += 0.022;
          model.position.y = Math.sin(tick / 40) * 0.04;
        }
        if (renderer && scene && camera) renderer.render(scene, camera);
      };
      animate();
    }

    // Use ResizeObserver so we initialise only once real pixel dimensions exist.
    // This handles the cold-start case where clientWidth is 0 at effect time.
    let initialised = false;
    const ro = new ResizeObserver((entries) => {
      if (initialised || disposed) return;
      const entry = entries[0];
      if (!entry) return;
      const w = Math.round(entry.contentRect.width);
      const h = Math.round(entry.contentRect.height);
      if (w > 0 && h > 0) {
        initialised = true;
        init(w, h);
      }
    });
    ro.observe(host);

    // Fallback: if the element already has dimensions, fire immediately.
    const fw = host.clientWidth;
    const fh = host.clientHeight;
    if (fw > 0 && fh > 0 && !initialised) {
      initialised = true;
      ro.disconnect();
      init(fw, fh);
    }

    return () => {
      disposed = true;
      ro.disconnect();
      cancelAnimationFrame(raf);
      model = null;
      if (scene) {
        scene.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.geometry?.dispose();
            const mat = mesh.material;
            if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
            else mat?.dispose?.();
          }
        });
      }
      if (renderer) {
        renderer.dispose();
        if (renderer.domElement.parentElement === host) {
          host.removeChild(renderer.domElement);
        }
      }
    };
  }, []);

  return <div ref={hostRef} className={className} style={style} aria-hidden role="presentation" />;
}
