import type { BufferGeometry } from 'three';

/** One surface decal: a stud of the given radius pinned at a rest position. */
export interface ShapeDecal {
  x: number;
  y: number;
  z: number;
  r: number;
  /** which material the engine should use — see DECO_MATERIALS */
  mat?: 'eye' | 'ink' | 'seed' | 'nose' | 'blush' | 'shine' | 'belly' | 'frost';
  /** per-axis scale; sz defaults to .55 so a stud is flattened onto the shell */
  sx?: number;
  sy?: number;
  sz?: number;
  /** rotation about Z, in radians */
  tilt?: number;
}

/** Type surface for the ported shape generators (vendor/shapes.js). */
export function makeShape(name: string): {
  geometry: BufferGeometry;
  face: ShapeDecal[];
};
