'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import {
  ScenarioId, PhysicsParams, PARTICLE_RADIUS,
  createWorld, makeGroundBody, makeParticleMaterial,
} from '@/lib/physics';

interface Props {
  scenario: ScenarioId;
  params: PhysicsParams;
  showVectors: boolean;
}

const PALETTE: Record<ScenarioId, number[]> = {
  inversion: [0x6366f1, 0x818cf8, 0xa5b4fc, 0xc7d2fe, 0xe0e7ff],
  levitation: [0x10b981, 0x34d399, 0x6ee7b7, 0x059669, 0xd1fae5],
  repulsion:  [0xf59e0b, 0xfbbf24, 0xfcd34d, 0xef4444, 0xfca5a5],
};

export function ParticleSystem({ scenario, params, showVectors }: Props) {
  const meshRef    = useRef<THREE.InstancedMesh>(null!);
  const arrowsRef  = useRef<THREE.Group>(null!);
  const worldRef   = useRef<CANNON.World | null>(null);
  const bodiesRef  = useRef<CANNON.Body[]>([]);

  const dummy   = useMemo(() => new THREE.Object3D(), []);
  const matrix  = useMemo(() => new THREE.Matrix4(), []);
  const colors  = useMemo(() => PALETTE[scenario], [scenario]);

  // Build / rebuild physics world whenever scenario or particleCount changes
  useEffect(() => {
    // Destroy old world
    worldRef.current = null;
    bodiesRef.current = [];

    const world = createWorld(scenario, params);
    const ground = makeGroundBody(scenario);
    world.addBody(ground);

    const pMat = makeParticleMaterial(params.restitution);
    const shape = new CANNON.Sphere(PARTICLE_RADIUS);

    const count = params.particleCount;
    const newBodies: CANNON.Body[] = [];

    for (let i = 0; i < count; i++) {
      const body = new CANNON.Body({
        mass: 0.5 + Math.random() * 1.0,
        material: pMat,
        linearDamping: 0.05,
        angularDamping: 0.1,
      });
      body.addShape(shape);

      // Spread over a 14×14 grid, slightly above floor / below ceiling
      const startY = scenario === 'inversion' ? 18 + Math.random() * 1.5 : 1 + Math.random() * 5;
      body.position.set(
        (Math.random() - 0.5) * 14,
        startY,
        (Math.random() - 0.5) * 14,
      );
      body.velocity.set(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
      );
      world.addBody(body);
      newBodies.push(body);
    }

    worldRef.current = world;
    bodiesRef.current = newBodies;

    // Colour each instance
    if (meshRef.current) {
      const col = new THREE.Color();
      for (let i = 0; i < count; i++) {
        col.setHex(colors[i % colors.length]);
        meshRef.current.setColorAt(i, col);
      }
      meshRef.current.instanceColor!.needsUpdate = true;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario, params.particleCount]);

  // Per-frame physics step + sync
  useFrame((_, delta) => {
    const world = worldRef.current;
    if (!world) return;

    const dt = Math.min(delta, 0.05) * params.slowMo;
    const count = bodiesRef.current.length;

    // Scenario-specific per-tick forces
    bodiesRef.current.forEach((body) => {
      const pos = body.position;

      if (scenario === 'levitation') {
        const dx = pos.x, dz = pos.z;
        const dist2D = Math.sqrt(dx * dx + dz * dz);
        if (dist2D < params.fieldRadius) {
          // Counter gravity + slight upward push
          const lift = body.mass * params.gravityStrength * 1.15;
          body.applyForce(new CANNON.Vec3(0, lift, 0), body.position);
        }
      }

      if (scenario === 'repulsion') {
        const dist = Math.sqrt(pos.x ** 2 + pos.y ** 2 + pos.z ** 2);
        if (dist < params.fieldRadius && dist > 0.01) {
          const strength = (body.mass * params.gravityStrength * 18) / (dist * dist + 0.5);
          const fx = (pos.x / dist) * strength;
          const fy = (pos.y / dist) * strength;
          const fz = (pos.z / dist) * strength;
          body.applyForce(new CANNON.Vec3(fx, fy, fz), body.position);
        }
      }
    });

    world.step(1 / 60, dt, 3);

    // Sync Three.js instances
    if (!meshRef.current) return;
    for (let i = 0; i < count; i++) {
      const b = bodiesRef.current[i];
      dummy.position.set(b.position.x, b.position.y, b.position.z);
      dummy.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;

    // Force vector arrows (cap at 50)
    if (showVectors && arrowsRef.current) {
      const arrows = arrowsRef.current.children as THREE.ArrowHelper[];
      const show = Math.min(count, 50);
      for (let i = 0; i < show; i++) {
        const b = bodiesRef.current[i];
        const f = b.force;
        const fLen = Math.sqrt(f.x ** 2 + f.y ** 2 + f.z ** 2);
        if (arrows[i] && fLen > 0.01) {
          arrows[i].position.set(b.position.x, b.position.y, b.position.z);
          arrows[i].setDirection(new THREE.Vector3(f.x / fLen, f.y / fLen, f.z / fLen));
          arrows[i].setLength(Math.min(fLen * 0.008, 2.5));
        }
      }
    }
  });

  const count = params.particleCount;
  const showCount = Math.min(count, 50);

  return (
    <group>
      <instancedMesh ref={meshRef} args={[undefined, undefined, count]} castShadow receiveShadow>
        <sphereGeometry args={[PARTICLE_RADIUS, 12, 8]} />
        <meshPhysicalMaterial roughness={0.3} metalness={0.4} envMapIntensity={1} />
      </instancedMesh>

      {showVectors && (
        <group ref={arrowsRef}>
          {Array.from({ length: showCount }).map((_, i) => (
            <arrowHelper
              key={i}
              args={[new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 1, 0xffffff, 0.3, 0.2]}
            />
          ))}
        </group>
      )}
    </group>
  );
}
