import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { SomyaState, SomyaEmotion } from '../types';
import { EMOTION_PROFILES } from '../utils/emotionManager';

interface HologramAvatarProps {
  state: SomyaState;
  emotion: SomyaEmotion;
  isSpeaking: boolean;
  audioLevel: number;
}

export const HologramAvatar: React.FC<HologramAvatarProps> = ({
  state,
  emotion,
  isSpeaking,
  audioLevel,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Stable mutable refs for values that change rapidly during animation/listening
  // to prevent recreating the Three.js WebGL scene on every frame
  const audioLevelRef = useRef<number>(audioLevel);
  const isSpeakingRef = useRef<boolean>(isSpeaking);
  const stateRef = useRef<SomyaState>(state);

  useEffect(() => {
    audioLevelRef.current = audioLevel;
  }, [audioLevel]);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 380;
    const height = mount.clientHeight || 380;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 5.2;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // Color mapping from EMOTION_PROFILES
    const getAvatarColor = () => {
      return EMOTION_PROFILES[emotion]?.avatarColorHex ?? 0x38bdf8;
    };

    const avatarGroup = new THREE.Group();
    scene.add(avatarGroup);

    // Head Icosahedron Cyber Mesh
    const headGeometry = new THREE.IcosahedronGeometry(1.25, 3);
    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: getAvatarColor(),
      wireframe: true,
      transparent: true,
      opacity: 0.75,
    });
    const headMesh = new THREE.Mesh(headGeometry, wireframeMaterial);
    avatarGroup.add(headMesh);

    // Inner Glowing Core
    const innerGeo = new THREE.SphereGeometry(0.75, 16, 16);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: false,
      transparent: true,
      opacity: 0.35,
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    headMesh.add(innerMesh);

    // Holographic Eye Visor Line
    const visorGeo = new THREE.TorusGeometry(1.15, 0.04, 8, 32, Math.PI * 0.9);
    const visorMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
    });
    const visorMesh = new THREE.Mesh(visorGeo, visorMat);
    visorMesh.rotation.x = Math.PI * 0.1;
    visorMesh.position.z = 0.45;
    headMesh.add(visorMesh);

    // Orbiting data rings
    const ringGeo = new THREE.RingGeometry(1.7, 1.74, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: getAvatarColor(),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2.5;
    avatarGroup.add(ringMesh);

    // Particle field around head
    const particleCount = 120;
    const particleGeo = new THREE.BufferGeometry();
    const posArray = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      const radius = 1.8 + Math.random() * 1.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      posArray[i] = radius * Math.sin(phi) * Math.cos(theta);
      posArray[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
      posArray[i + 2] = radius * Math.cos(phi);
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const particleMat = new THREE.PointsMaterial({
      size: 0.035,
      color: getAvatarColor(),
      transparent: true,
      opacity: 0.6,
    });
    const particleMesh = new THREE.Points(particleGeo, particleMat);
    avatarGroup.add(particleMesh);

    // Mouse tracking
    let targetRotY = 0;
    let targetRotX = 0;
    const handleMouseMove = (e: MouseEvent) => {
      const rect = mount.getBoundingClientRect();
      const x = (e.clientX - rect.left) / width - 0.5;
      const y = (e.clientY - rect.top) / height - 0.5;
      targetRotY = x * 0.8;
      targetRotX = y * 0.5;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Animation Loop with THREE.Timer
    const timer = new THREE.Timer();
    timer.connect(document);
    let animId: number;

    const animate = (timestamp?: number) => {
      timer.update(timestamp);
      const delta = timer.getDelta();
      const time = timer.getElapsed();

      // Smooth look-at mouse interpolation
      avatarGroup.rotation.y += (targetRotY - avatarGroup.rotation.y) * 0.05;
      avatarGroup.rotation.x += (targetRotX - avatarGroup.rotation.x) * 0.05;

      // Organic idle breathing
      avatarGroup.position.y = Math.sin(time * 1.5) * 0.08;

      // Speaking mouth resonance & head nod
      if (isSpeakingRef.current) {
        const mouthPulse = Math.sin(time * 16) * 0.08;
        headMesh.scale.set(1 + mouthPulse * 0.5, 1 - mouthPulse, 1 + mouthPulse * 0.5);
        headMesh.position.y = Math.sin(time * 8) * 0.05;
      } else if (stateRef.current === 'LISTENING') {
        const micPulse = audioLevelRef.current * 0.2;
        headMesh.scale.set(1 + micPulse, 1 + micPulse, 1 + micPulse);
      } else {
        headMesh.scale.set(1, 1, 1);
        headMesh.position.y = 0;
      }

      // Orbital rotation
      ringMesh.rotation.z += delta * 0.6;
      particleMesh.rotation.y += delta * 0.2;

      renderer.render(scene, camera);
      animId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      if (!mount) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
      timer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [emotion]);

  return (
    <div
      ref={mountRef}
      className="relative w-[340px] h-[340px] md:w-[420px] md:h-[420px] flex items-center justify-center cursor-pointer select-none"
    />
  );
};
