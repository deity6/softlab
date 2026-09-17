import type { DataTexture } from 'three';

/**
 * Type surface for the ported RGBE loader (vendor/HDRLoader.js).
 * Declared standalone on purpose — the JS class extends three's
 * DataTextureLoader, but only `load()` is ever called from here.
 */
export class HDRLoader {
  load(
    url: string,
    onLoad?: (texture: DataTexture) => void,
    onProgress?: (event: unknown) => void,
    onError?: (error: unknown) => void,
  ): DataTexture;
}
