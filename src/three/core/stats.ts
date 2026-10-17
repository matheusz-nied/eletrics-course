/**
 * Rough cost of what a part draws: draw calls, triangles and texture memory.
 * Used by `?efeitos=stats` and by the kit's performance check, to keep every
 * part inside the budget of a mid-range phone.
 */
import { InstancedMesh, Mesh, type Material, type Object3D, type Texture } from 'three';

export interface RenderStats {
  drawCalls: number;
  triangles: number;
  /** Texture memory (MB), counting 4 bytes per texel plus mipmaps. */
  textureMB: number;
}

const TEXTURE_SLOTS = [
  'map',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'aoMap',
  'bumpMap',
  'emissiveMap',
  'alphaMap',
  'clearcoatMap',
  'clearcoatRoughnessMap',
] as const;

function textureBytes(texture: Texture): number {
  const image = texture.image as { width?: number; height?: number } | undefined;
  const texels = (image?.width ?? 0) * (image?.height ?? 0);
  return texels * 4 * (texture.generateMipmaps ? 4 / 3 : 1);
}

export function renderStats(root: Object3D): RenderStats {
  let drawCalls = 0;
  let triangles = 0;
  const textures = new Set<Texture>();
  root.traverseVisible((object) => {
    if (!(object instanceof Mesh)) return;
    const geometry = object.geometry;
    const instances = object instanceof InstancedMesh ? object.count : 1;
    if (instances === 0) return;
    const materials: Material[] = Array.isArray(object.material)
      ? object.material
      : [object.material];
    const total = (geometry.index?.count ?? geometry.attributes.position?.count ?? 0) / 3;
    if (Array.isArray(object.material) && geometry.groups.length > 0) {
      for (const group of geometry.groups) {
        if (!materials[group.materialIndex ?? 0]?.visible) continue;
        drawCalls++;
        triangles += (Math.min(group.count, total * 3) / 3) * instances;
      }
    } else if (materials[0]?.visible !== false) {
      drawCalls++;
      triangles += total * instances;
    }
    for (const material of materials) {
      const slots = material as unknown as Record<string, unknown>;
      for (const slot of TEXTURE_SLOTS) {
        const texture = slots[slot];
        if (texture && (texture as Texture).isTexture) textures.add(texture as Texture);
      }
    }
  });
  let bytes = 0;
  for (const texture of textures) bytes += textureBytes(texture);
  return { drawCalls, triangles: Math.round(triangles), textureMB: bytes / 2 ** 20 };
}
