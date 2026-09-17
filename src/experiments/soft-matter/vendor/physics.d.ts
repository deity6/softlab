import type { Quaternion, Vector3 } from 'three';

/**
 * Type surface for the ported rigid-body solver (vendor/physics.js).
 * The implementation is untyped JS carried over from the reference project, so
 * the shape it actually exposes is declared here rather than inferred.
 */
export class SoftBodyMotion {
  center: Vector3;
  support: Vector3[];
  inertia: Vector3;
  position: number[];
  velocity: number[];
  rotation: Quaternion;
  angularVelocity: Vector3;
  squash: number;
  squashVelocity: number;
  lastImpact: number;
  lowest: number;

  reset(): void;
  setShape(vertices: Float32Array): void;
  drop(height?: number): void;
  step(dt: number, options?: Record<string, unknown>): void;
  applyTorque(value: Vector3, dt: number): void;
}
