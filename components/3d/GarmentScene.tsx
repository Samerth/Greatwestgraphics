"use client";

import { useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export interface GarmentSceneProps {
  modelUrl: string;
  textureUrl?: string | null;
  onLoad?: (scene: THREE.Scene) => void;
  onError?: (error: Error) => void;
}

/**
 * 3D scene setup using Three.js. Loads a garment model and applies
 * texture as an image or canvas texture.
 */
export function GarmentScene({
  modelUrl,
  textureUrl,
  onLoad,
  onError,
}: GarmentSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xfafafa);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000,
    );
    camera.position.set(0, 0, 1.5);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Load model
    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => {
        const model = gltf.scene;
        model.scale.set(1, 1, 1);
        model.position.set(0, 0, 0);

        // Enable shadows
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            // Apply texture if provided
            if (textureUrl) {
              const textureLoader = new THREE.TextureLoader();
              textureLoader.load(textureUrl, (texture) => {
                texture.flipY = false;
                if (child.material instanceof THREE.MeshStandardMaterial) {
                  child.material.map = texture;
                  child.material.needsUpdate = true;
                }
              });
            }
          }
        });

        scene.add(model);
        modelRef.current = model;
        onLoad?.(scene);
      },
      undefined,
      (error) => {
        console.error("Failed to load garment model:", error);
        onError?.(error instanceof Error ? error : new Error(String(error)));
      },
    );

    // Auto-rotate
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);

      if (modelRef.current) {
        modelRef.current.rotation.y += 0.005;
      }

      renderer.render(scene, camera);
    };
    animate();

    // Handle window resize
    const handleResize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationId);
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [modelUrl, textureUrl, onLoad, onError]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg overflow-hidden"
      style={{ minHeight: "400px" }}
    />
  );
}
