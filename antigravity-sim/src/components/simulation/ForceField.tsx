'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ScenarioId } from '@/lib/physics';

interface Props {
  scenario: ScenarioId;
  fieldRadius: number;
}

const COLORS: Record<ScenarioId, { ring: string; core: string }> = {
  inversion: { ring: '#6366f1', core: '#818cf8' },
  levitation:{ ring: '#10b981', core: '#34d399' },
  repulsion: { ring: '#f59e0b', core: '#ef4444' },
};

export function ForceField({ scenario, fieldRadius }: Props) {
  const ringRef = useRef<THREE.Mesh>(null!);
  const coreRef = useRef<THREE.Mesh>(null!);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ringRef.current) {
      ringRef.current.rotation.y = t * 0.4;
      ringRef.current.rotation.x = Math.sin(t * 0.3) * 0.3;
      const pulse = 1 + Math.sin(t * 2) * 0.04;
      ringRef.current.scale.setScalar(pulse);
    }
    if (coreRef.current) {
      const p = 0.8 + Math.sin(t * 3) * 0.15;
      coreRef.current.scale.setScalar(p);
      (coreRef.current.material as THREE.MeshBasicMaterial).opacity = 0.12 + Math.sin(t * 2) * 0.06;
    }
  });

  if (scenario === 'inversion') return null; // global field — no visual needed

  const c = COLORS[scenario];

  return (
    <group>
      {/* Outer wireframe ring */}
      <mesh ref={ringRef}>
        <torusGeometry args={[fieldRadius, 0.04, 12, 80]} />
        <meshBasicMaterial color={c.ring} transparent opacity={0.7} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[fieldRadius, 0.04, 12, 80]} />
        <meshBasicMaterial color={c.ring} transparent opacity={0.35} />
      </mesh>

      {/* Glowing core sphere */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[scenario === 'repulsion' ? 0.8 : 0.3, 24, 16]} />
        <meshBasicMaterial color={c.core} transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>

      {/* Radius indicator disc (levitation only) */}
      {scenario === 'levitation' && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <circleGeometry args={[fieldRadius, 64]} />
          <meshBasicMaterial color={c.ring} transparent opacity={0.07} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}
