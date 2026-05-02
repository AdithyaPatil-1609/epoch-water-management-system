import * as CANNON from 'cannon-es';

export type ScenarioId = 'inversion' | 'levitation' | 'repulsion';

export interface PhysicsParams {
  gravityStrength: number;   // magnitude (sign controlled per scenario)
  fieldRadius: number;       // metres, used by levitation + repulsion
  particleCount: number;     // 20 – 200
  restitution: number;       // bounciness 0-1
  slowMo: number;            // timestep multiplier 0.1-1
}

export const DEFAULT_PARAMS: PhysicsParams = {
  gravityStrength: 9.81,
  fieldRadius: 6,
  particleCount: 80,
  restitution: 0.4,
  slowMo: 1,
};

export interface ScenarioConfig {
  id: ScenarioId;
  label: string;
  description: string;
  icon: string;
  accentColor: string;
  floorColor: string;
}

export const SCENARIOS: ScenarioConfig[] = [
  {
    id: 'inversion',
    label: 'Gravity Inversion',
    description: 'Global gravity is reversed — objects fall upward and rain against the ceiling.',
    icon: '↑',
    accentColor: '#6366f1',
    floorColor: '#1e1b4b',
  },
  {
    id: 'levitation',
    label: 'Levitation Field',
    description: 'A cylindrical exotic-matter field counteracts gravity within its radius.',
    icon: '◎',
    accentColor: '#10b981',
    floorColor: '#052e16',
  },
  {
    id: 'repulsion',
    label: 'Repulsion Zone',
    description: 'A spherical repulsor at the centre explosively scatters any nearby mass.',
    icon: '✦',
    accentColor: '#f59e0b',
    floorColor: '#1c1200',
  },
];

/** Build a fresh Cannon-ES world for a given scenario */
export function createWorld(scenario: ScenarioId, params: PhysicsParams): CANNON.World {
  const world = new CANNON.World();
  world.broadphase = new CANNON.SAPBroadphase(world);
  (world.solver as CANNON.GSSolver).iterations = 10;
  world.allowSleep = true;

  switch (scenario) {
    case 'inversion':
      world.gravity.set(0, params.gravityStrength, 0); // UP
      break;
    case 'levitation':
    case 'repulsion':
      world.gravity.set(0, -params.gravityStrength, 0); // DOWN (field overrides locally)
      break;
  }

  return world;
}

/** Shared sphere shape, reused across particles */
export const PARTICLE_RADIUS = 0.28;

export function makeParticleMaterial(restitution: number) {
  return new CANNON.Material('particle');
}

export function makeGroundBody(scenario: ScenarioId): CANNON.Body {
  const groundMat = new CANNON.Material('ground');
  const body = new CANNON.Body({ mass: 0, material: groundMat });
  body.addShape(new CANNON.Plane());
  // For inversion the "ceiling" is at y=20, rotated 180°
  if (scenario === 'inversion') {
    body.position.set(0, 20, 0);
    body.quaternion.setFromEuler(Math.PI, 0, 0);
  } else {
    body.position.set(0, -0.5, 0);
    body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  }
  return body;
}
