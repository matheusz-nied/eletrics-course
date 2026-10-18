/**
 * Shared pieces of the particle effects (smoke, sparks): a deterministic
 * random generator, a soft round sprite and a camera-facing quad shader
 * driven by per-instance attributes.
 */
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  NormalBlending,
  PlaneGeometry,
  ShaderMaterial,
  type Texture,
} from 'three';

/** Small seeded generator (mulberry32): the same effect looks the same every time. */
export function random(seed = 1): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let puff: Texture | null = null;

/** Soft round puff with a little turbulence, white with alpha. */
export function getPuffTexture(): Texture {
  if (puff) return puff;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = random(7);
  // A few overlapping blobs make the edge irregular, like a real puff.
  for (let i = 0; i < 14; i++) {
    const a = rand() * Math.PI * 2;
    const d = rand() * size * 0.16;
    const x = size / 2 + Math.cos(a) * d;
    const y = size / 2 + Math.sin(a) * d;
    const r = size * (0.22 + rand() * 0.16);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.22)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.08)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  puff = new CanvasTexture(canvas);
  return puff;
}

export interface QuadBuffers {
  geometry: InstancedBufferGeometry;
  /** Per instance: x, y, z (part space). */
  offset: Float32Array;
  /** Per instance: size (mm), rotation (rad), alpha, stretch (0 = round). */
  shape: Float32Array;
  /** Per instance: x, y, z of the velocity direction (sparks). */
  direction: Float32Array;
  /** Per instance: r, g, b (linear, may exceed 1 to bloom). */
  color: Float32Array;
  update: () => void;
}

/** Camera-facing quads, one per instance; write the arrays and call update(). */
export function createQuads(count: number): QuadBuffers {
  const base = new PlaneGeometry(1, 1);
  const geometry = new InstancedBufferGeometry();
  geometry.index = base.index;
  geometry.setAttribute('position', base.attributes.position!);
  geometry.setAttribute('uv', base.attributes.uv!);
  const offset = new Float32Array(count * 3);
  const shape = new Float32Array(count * 4);
  const direction = new Float32Array(count * 3);
  const color = new Float32Array(count * 3);
  const attrs = {
    aOffset: new InstancedBufferAttribute(offset, 3),
    aShape: new InstancedBufferAttribute(shape, 4),
    aDirection: new InstancedBufferAttribute(direction, 3),
    aColor: new InstancedBufferAttribute(color, 3),
  };
  for (const [name, attr] of Object.entries(attrs)) {
    attr.setUsage(DynamicDrawUsage);
    geometry.setAttribute(name, attr);
  }
  geometry.instanceCount = count;
  base.dispose();
  return {
    geometry,
    offset,
    shape,
    direction,
    color,
    update: () => {
      for (const attr of Object.values(attrs)) attr.needsUpdate = true;
    },
  };
}

const vertexShader = /* glsl */ `
  attribute vec3 aOffset;
  attribute vec4 aShape;
  attribute vec3 aDirection;
  attribute vec3 aColor;
  varying vec2 vUv;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vUv = uv;
    vAlpha = aShape.z;
    vColor = aColor;
    vec4 center = modelViewMatrix * vec4(aOffset, 1.0);
    vec2 corner = position.xy;
    float size = aShape.x;
    if (aShape.w > 0.0) {
      // Streak: stretched along the projected direction of motion.
      vec3 d = (modelViewMatrix * vec4(aDirection, 0.0)).xyz;
      vec2 along = length(d.xy) > 1e-5 ? normalize(d.xy) : vec2(1.0, 0.0);
      vec2 across = vec2(-along.y, along.x);
      center.xy += along * corner.x * size * aShape.w + across * corner.y * size;
    } else {
      float c = cos(aShape.y);
      float s = sin(aShape.y);
      center.xy += mat2(c, s, -s, c) * corner * size;
    }
    gl_Position = projectionMatrix * center;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform bool useMap;
  varying vec2 vUv;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    float a;
    if (useMap) {
      a = texture2D(map, vUv).a;
    } else {
      // Soft round dot (streaks are stretched dots).
      vec2 p = vUv * 2.0 - 1.0;
      a = smoothstep(1.0, 0.0, length(p));
      a *= a;
    }
    a *= vAlpha;
    if (a < 0.002) discard;
    gl_FragColor = vec4(vColor, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** Material for `createQuads`: smoke (normal blending, puff texture) or glowing sparks (additive). */
export function createQuadMaterial(kind: 'smoke' | 'glow'): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      map: { value: kind === 'smoke' ? getPuffTexture() : null },
      useMap: { value: kind === 'smoke' },
      tint: { value: new Color(1, 1, 1) },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: kind === 'smoke' ? NormalBlending : AdditiveBlending,
    toneMapped: true,
  });
}
