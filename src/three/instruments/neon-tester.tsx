/**
 * Screwdriver voltage tester (chave de teste neon): steel blade with an
 * insulating sleeve, transparent handle with a ~1 MΩ resistor, a neon glow
 * lamp and a spring in series, and a metal cap where the finger touches.
 * Typical sizes: 100–190 mm long, Ø 10–11 mm handle, 3 mm blade; lamp
 * Ø 5 × 14 mm (NE-2 class, strikes at ~70 V). Lying on the table with the
 * pocket clip up. `lit` makes the gas around both electrodes glow orange
 * (on AC both electrodes glow).
 */
import { useMemo } from 'react';
import { Explode, Anchor } from '../core/view';
import { emission, GLOW, GlowSprite } from '../fx/glow';
import { Material } from '../materials/Material';
import { getNoiseTexture, useCanvasTexture } from '../materials/textures';
import { axialLathe } from '../shapes/geometry';
import { useDisposable, Wire } from '../shapes/Wire';
import { BAND_RGB } from '../core/colorCode';
import type { PartMeta, Vec3 } from '../types';
import { CatmullRomCurve3, ExtrudeGeometry, Shape, TubeGeometry, Vector3 } from 'three';

export interface NeonTesterProps {
  /** The tip touches a live conductor: the neon lamp glows. */
  lit?: boolean;
  /** Overall length in mm (100–190). */
  length?: number;
}

const HANDLE_R = 5.2;
const BORE_R = 3.1;
const CAP_LEN = 8;
const NEON = '#ff5a14';

export const meta: PartMeta = {
  id: 'neon-tester',
  label: 'Chave de teste neon',
  category: 'instrumentos',
  summary:
    'Chave de teste com lâmpada neon: ponta metálica, resistor, lâmpada e mola em série dentro do cabo transparente.',
  defaults: { lit: true, length: 140 },
  controls: {
    lit: { kind: 'toggle', label: 'Lâmpada acesa (ponta na fase)' },
    length: { kind: 'number', label: 'Comprimento', min: 100, max: 190, step: 5, unit: 'mm' },
  },
  annotations: (p) => {
    const g = geometryOf(Number(p.length));
    return [
      { at: [g.x0 + 2, 2, 0], text: 'Ponta: encoste no fio ou no borne', exploded: false },
      { at: [g.xh - g.blade * 0.45, 2.2, 0], text: 'Haste isolada', exploded: false },
      { at: [0, 0, 0], text: 'Lâmpada neon: acende acima de ~70 V', anchor: 'lamp' },
      { at: [0, 0, 0], text: 'Resistor de ~1 MΩ: limita a corrente', anchor: 'resistor' },
      { at: [0, 0, 0], text: 'Mola: liga a lâmpada à tampa', anchor: 'spring', exploded: true },
      { at: [0, 0, 0], text: 'Tampa metálica: encoste o dedo aqui', anchor: 'cap' },
      { at: [0, 0, 0], text: 'Clipe de bolso', anchor: 'clip', exploded: false },
    ];
  },
  explode: true,
  cutaway: true,
  describe: (p) =>
    p.lit
      ? `Chave de teste neon de ${Number(p.length)} mm, acesa: a ponta está num condutor energizado (fase). A corrente passa pelo resistor, pela lâmpada e pelo seu corpo até o chão, limitada pelo resistor a cerca de 0,1 mA.`
      : `Chave de teste neon de ${Number(p.length)} mm, apagada: a ponta não tem tensão em relação ao chão (neutro, terra ou circuito desligado). Antes de confiar nela, teste numa tomada que você sabe que está energizada.`,
  view: [0.06, 0.8, 1.3],
};

/** Positions along X (mm): tip x0, handle start xh, cap start xc. */
function geometryOf(length: number) {
  const L = Math.min(Math.max(length || 140, 100), 190);
  const handle = Math.round(L * 0.5 + 3);
  const blade = L - handle - CAP_LEN;
  const x0 = -L / 2;
  const xh = x0 + blade;
  const xc = xh + handle;
  return { L, handle, blade, x0, xh, xc };
}

/** Handle bore layout, measured from the nose of the handle. */
const INNER = { bladeEnd: 15, resistor: [17.2, 23.5], lamp: [26, 40], spring: [41, 50] } as const;

export default function NeonTester(props: NeonTesterProps) {
  const p = { ...meta.defaults, ...props } as Required<NeonTesterProps>;
  const g = geometryOf(p.length);
  const lit = !!p.lit;
  const noise = getNoiseTexture();

  // Transparent handle: hollow shell (outer profile, then the bore back).
  const handleGeometry = useDisposable(() => {
    const H = g.handle;
    const outer: [number, number][] = [
      [1.75, 0],
      [2.2, 0.6],
      [3.2, 4],
      [4.6, 10],
      [HANDLE_R, 15],
    ];
    // Shallow finger rings on the grip.
    for (let t = 18; t <= H - 14; t += 1) {
      const s = Math.sin(((t - 18) / 4) * Math.PI);
      outer.push([HANDLE_R - 0.22 * s * s, t]);
    }
    outer.push([HANDLE_R, H - 1], [HANDLE_R - 0.3, H]);
    const inner: [number, number][] = [
      [BORE_R, H],
      [BORE_R, 9],
      [1.6, 8],
      [1.6, 0.4],
      [1.75, 0],
    ];
    return axialLathe([...outer, ...inner], 40);
  }, [g.handle]);

  const sleeve = useDisposable(
    () =>
      axialLathe(
        [
          [0, 0],
          [1.85, 0],
          [1.85, g.blade - 6],
          [1.7, g.blade - 6.4],
          [0, g.blade - 6.4],
        ],
        24,
      ),
    [g.blade],
  );

  const blade = useDisposable(() => {
    // Side profile of the flat tip, extruded across its 3 mm width.
    const s = new Shape();
    s.moveTo(0, -0.25);
    s.lineTo(7, -1.5);
    s.lineTo(7, 1.5);
    s.lineTo(0, 0.25);
    s.closePath();
    const geo = new ExtrudeGeometry(s, {
      depth: 2.4,
      bevelEnabled: true,
      bevelThickness: 0.3,
      bevelSize: 0.15,
      bevelSegments: 2,
    });
    geo.translate(0, 0, -1.2);
    return geo;
  }, []);

  const cap = useDisposable(
    () =>
      axialLathe(
        [
          [HANDLE_R - 0.5, -3],
          [HANDLE_R + 0.25, -3],
          [HANDLE_R + 0.3, CAP_LEN - 3.5],
          [HANDLE_R - 0.6, CAP_LEN - 1.2],
          [3.4, CAP_LEN - 0.2],
          [0, CAP_LEN],
        ],
        40,
      ),
    [],
  );

  const lampGlass = useDisposable(() => {
    const len = INNER.lamp[1] - INNER.lamp[0];
    const r = 2.55;
    const profile: [number, number][] = [[0, 0]];
    for (let i = 0; i <= 8; i++) {
      const a = (Math.PI / 2) * (i / 8);
      profile.push([r * Math.sin(a), r * 0.9 * (1 - Math.cos(a))]);
    }
    for (let i = 0; i <= 8; i++) {
      const a = (Math.PI / 2) * (i / 8);
      profile.push([r * Math.cos(a), len - r * 0.9 * (1 - Math.sin(a))]);
    }
    profile.push([0, len]);
    return axialLathe(profile, 28);
  }, []);

  const spring = useDisposable(() => {
    const [a, b] = INNER.spring;
    const turns = 6.5;
    const points: Vector3[] = [];
    for (let i = 0; i <= turns * 16; i++) {
      const t = i / (turns * 16);
      const ang = t * turns * Math.PI * 2;
      points.push(new Vector3(a + (b - a) * t, Math.cos(ang) * 2.2, Math.sin(ang) * 2.2));
    }
    return new TubeGeometry(new CatmullRomCurve3(points), Math.round(turns * 24), 0.32, 6, false);
  }, []);

  const clip = useDisposable(() => {
    // Longitudinal section of the pocket clip (X along the handle, Y up).
    const len = Math.min(48, g.handle * 0.66);
    const y0 = HANDLE_R + 0.1;
    const s = new Shape();
    s.moveTo(4, y0);
    s.lineTo(4, y0 + 1.6);
    s.lineTo(-len + 6, y0 + 1.8);
    s.quadraticCurveTo(-len + 1, y0 + 1.6, -len, y0 + 0.2);
    s.lineTo(-len + 0.6, y0 - 0.2);
    s.quadraticCurveTo(-len + 2, y0 + 0.95, -len + 6, y0 + 1.15);
    s.lineTo(3.4, y0 + 0.95);
    s.lineTo(3.4, y0);
    s.closePath();
    const geo = new ExtrudeGeometry(s, {
      depth: 4.2,
      bevelEnabled: true,
      bevelThickness: 0.15,
      bevelSize: 0.12,
      bevelSegments: 2,
      curveSegments: 8,
    });
    geo.translate(0, 0, -2.1);
    return geo;
  }, [g.handle]);

  const bands = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#d9c398';
      ctx.fillRect(0, 0, w, h);
      const colors = [BAND_RGB.marrom, BAND_RGB.preto, BAND_RGB.verde, BAND_RGB.dourado];
      [0.22, 0.38, 0.54, 0.8].forEach((pos, i) => {
        ctx.fillStyle = colors[i]!;
        ctx.fillRect(0, (1 - pos - 0.06) * h, w, 0.12 * h);
      });
    },
    'neon-res-1M',
    { width: 8, height: 256 },
  );
  const resistorGeometry = useDisposable(() => {
    const len = INNER.resistor[1] - INNER.resistor[0];
    const r = 1.15;
    const profile: [number, number][] = [[0, 0]];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const y = len * t;
      const end = Math.min(y, len - y);
      profile.push([r * (end < 0.5 ? 0.75 + 0.5 * end : 1), y]);
    }
    profile.push([0, len]);
    return axialLathe(profile, 24);
  }, []);

  const glow = emission(NEON, lit ? 1 : 0, GLOW);
  const soft = emission(NEON, lit ? 1 : 0, 4);
  const lampX = g.xh + INNER.lamp[0];
  const lampLen = INNER.lamp[1] - INNER.lamp[0];
  const toX: Vec3 = [0, 0, -Math.PI / 2];
  const axisY = HANDLE_R;
  const rodLength = g.blade - 6.5 + INNER.bladeEnd;

  const bladeLeads = useMemo(
    () => ({
      a: [
        [g.xh + INNER.bladeEnd, 0, 0],
        [g.xh + INNER.resistor[0] + 0.2, 0, 0],
      ] as Vec3[],
      b: [
        [g.xh + INNER.resistor[1] - 0.2, 0, 0],
        [lampX + 0.5, 0, 0],
      ] as Vec3[],
    }),
    [g.xh, lampX],
  );

  return (
    <group position={[0, axisY, 0]}>
      {/* Blade: steel rod with its flat tip and the insulating sleeve. */}
      <Explode offset={[-30, 0, 0]}>
        <mesh position={[g.x0 + 6.5 + rodLength / 2, 0, 0]} rotation={toX}>
          <cylinderGeometry args={[1.5, 1.5, rodLength, 20]} />
          <Material preset="chrome" color="#d7dadd" roughness={0.18} />
        </mesh>
        <group position={[g.x0, 0, 0]}>
          <mesh geometry={blade} rotation={[Math.PI / 2, 0, 0]}>
            <Material preset="chrome" color="#d7dadd" roughness={0.2} />
          </mesh>
        </group>
        <mesh position={[g.xh + INNER.bladeEnd, 0, 0]} rotation={toX}>
          <cylinderGeometry args={[2.6, 2.6, 1, 24]} />
          <Material preset="nickel" />
        </mesh>
        <group position={[g.x0 + 12, 0, 0]} rotation={toX}>
          <mesh geometry={sleeve}>
            <Material preset="pvc" color="#c4231c" roughness={0.35} clip cutColor="#8e1813" />
          </mesh>
        </group>
      </Explode>

      {/* Resistor and its leads. */}
      <Explode offset={[-14, 0, 0]}>
        <group position={[g.xh + INNER.resistor[0], 0, 0]} rotation={toX}>
          <mesh geometry={resistorGeometry}>
            <Material preset="lacquer" color="#ffffff" map={bands} roughness={0.45} />
          </mesh>
        </group>
        <Wire points={bladeLeads.a} radius={0.25} />
        <Wire points={bladeLeads.b} radius={0.25} />
        <Anchor name="resistor" position={[g.xh + 20, 1.4, 0]} />
      </Explode>

      {/* Neon lamp: glass envelope, two electrodes and the gas glow. */}
      <group>
        <group position={[lampX, 0, 0]} rotation={toX}>
          <mesh geometry={lampGlass}>
            <Material
              color={lit ? '#ffb48a' : '#f4efe9'}
              roughness={0.06}
              transparent
              opacity={lit ? 0.55 : 0.3}
              depthWrite={false}
              emissive={soft.emissive}
              emissiveIntensity={lit ? 1.6 : 0}
            />
          </mesh>
        </group>
        {[-1, 1].map((side) => {
          const inner = lampX + lampLen / 2 + side * 0.7;
          const outer = side < 0 ? lampX + 0.6 : lampX + lampLen - 0.6;
          const plateX = inner + side * 2.6;
          return (
            <group key={side}>
              <Wire
                points={[
                  [outer, 0, 0],
                  [plateX, 0, 0],
                ]}
                radius={0.22}
                material={{ preset: 'nickel' }}
              />
              <mesh position={[plateX - side * 2.6 + side * 0.0, 0, 0]}>
                <boxGeometry args={[5.2, 1.7, 0.18]} />
                <Material
                  preset="nickel"
                  roughness={0.35}
                  emissive={glow.emissive}
                  emissiveIntensity={lit ? 2.5 : 0}
                />
              </mesh>
              {lit && (
                <mesh position={[plateX - side * 2.6, 0, 0]} rotation={toX}>
                  <capsuleGeometry args={[0.95, 4.2, 4, 12]} />
                  <Material
                    color="#000000"
                    emissive={glow.emissive}
                    emissiveIntensity={glow.emissiveIntensity * 0.4}
                  />
                </mesh>
              )}
            </group>
          );
        })}
        <GlowSprite
          always
          color={NEON}
          intensity={lit ? 0.7 : 0}
          size={30}
          position={[lampX + lampLen / 2, 0, 0]}
        />
        <Anchor name="lamp" position={[lampX + lampLen / 2, 2.4, 0]} />
      </group>

      {/* Spring between the lamp and the cap. */}
      <Explode offset={[12, 0, 0]}>
        <group position={[g.xh, 0, 0]}>
          <mesh geometry={spring}>
            <Material preset="steel" color="#c7c9cc" roughness={0.3} />
          </mesh>
          <Anchor name="spring" position={[INNER.spring[0] + 4, 2.4, 0]} />
        </group>
      </Explode>

      {/* Transparent handle. */}
      <Explode offset={[0, 16, 0]}>
        <group position={[g.xh, 0, 0]} rotation={toX}>
          <mesh geometry={handleGeometry}>
            <Material
              preset="polycarbonate"
              color="#e9f2ff"
              transmission={0.96}
              roughness={0.05}
              thickness={1.2}
              attenuationColor="#d4e3ff"
              attenuationDistance={40}
              depthWrite={false}
              clip
              cutColor="#b9c9df"
            />
          </mesh>
        </group>
      </Explode>

      {/* Metal cap and pocket clip. */}
      <Explode offset={[28, 0, 0]}>
        <group position={[g.xc, 0, 0]} rotation={toX}>
          <mesh geometry={cap}>
            <Material preset="nickel" color="#cfd2d4" roughness={0.26} roughnessMap={noise} />
          </mesh>
        </group>
        <mesh position={[g.xc + 1.5, 0, 0]} rotation={toX}>
          <cylinderGeometry args={[2.4, 2.4, 3, 16]} />
          <Material preset="brass" />
        </mesh>
        <Anchor name="cap" position={[g.xc + CAP_LEN - 1, HANDLE_R, 0]} />
        <Explode offset={[0, 10, 0]}>
          <mesh geometry={clip} position={[g.xc, 0, 0]}>
            <Material preset="chrome" color="#d9dcdf" roughness={0.2} />
          </mesh>
          <Anchor name="clip" position={[g.xc - 22, HANDLE_R + 2, 0]} />
        </Explode>
      </Explode>
    </group>
  );
}
