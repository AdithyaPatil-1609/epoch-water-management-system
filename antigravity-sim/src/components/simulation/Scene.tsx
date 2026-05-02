'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, Stars } from '@react-three/drei';
import { ParticleSystem } from './ParticleSystem';
import { ForceField } from './ForceField';
import { ScenarioId, PhysicsParams, SCENARIOS } from '@/lib/physics';

interface Props {
  scenario: ScenarioId;
  params: PhysicsParams;
  showVectors: boolean;
}

function Floor({ scenario }: { scenario: ScenarioId }) {
  const s = SCENARIOS.find(s => s.id === scenario)!;
  return (
    <group>
      <Grid
        args={[40, 40]}
        cellSize={1}
        cellThickness={0.5}
        cellColor={s.accentColor}
        sectionSize={5}
        sectionThickness={1}
        sectionColor={s.accentColor}
        fadeDistance={30}
        fadeStrength={1}
        infiniteGrid
        position={[0, scenario === 'inversion' ? 20.1 : -0.4, 0]}
        rotation={scenario === 'inversion' ? [0, 0, 0] : [0, 0, 0]}
      />
      <mesh
        position={[0, scenario === 'inversion' ? 20 : -0.5, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color={s.floorColor} roughness={0.9} metalness={0.1} />
      </mesh>
    </group>
  );
}

export function Scene({ scenario, params, showVectors }: Props) {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 8, 22], fov: 55 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      style={{ background: '#070714' }}
    >
      <Stars radius={80} depth={50} count={3000} factor={3} fade speed={1} />

      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 20, 10]} intensity={1.2} castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[0, 6, 0]} intensity={2} color={SCENARIOS.find(s => s.id === scenario)!.accentColor} distance={20} />

      <Suspense fallback={null}>
        <Environment preset="night" />

        <Floor scenario={scenario} />
        <ForceField scenario={scenario} fieldRadius={params.fieldRadius} />
        <ParticleSystem scenario={scenario} params={params} showVectors={showVectors} />
      </Suspense>

      <OrbitControls
        enablePan={false}
        minDistance={6}
        maxDistance={40}
        autoRotate
        autoRotateSpeed={0.4}
      />
    </Canvas>
  );
}
