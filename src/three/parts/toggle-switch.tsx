/**
 * Switches with a lever:
 * - `alavanca`: panel toggle switch for 15 A 250 VAC with an M12 × 0,75
 *   threaded bushing, hex nut and washer, black phenolic body 20 × 13 ×
 *   19 mm and 6,3 mm solder / quick-connect lugs (2 = SPST, 3 = SPDT).
 *   Dimensions from typical catalogues of heavy-duty toggles (KN3 series).
 *   Inside: the lever pushes a spring-loaded plunger over a copper rocker,
 *   which tilts onto the contact of the opposite side (that is why the lever
 *   to the right closes the left lug).
 * - `deslizante`: miniature PCB slide switch (SS12D00 type, SPDT): steel
 *   cover 8,6 × 3,6 × 3,6 mm, 4 mm actuator, three pins at 3 mm.
 * The lever or slider moves smoothly when `on` changes.
 */
import { useRef } from 'react';
import { Path, Shape, type BufferGeometry, type Group } from 'three';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { getNoiseTexture } from '../materials/textures';
import { axialLathe, tube } from '../shapes/geometry';
import { useDisposable } from '../shapes/Wire';
import type { PartAnnotation, PartMeta, Vec3 } from '../types';
import {
  addRoundedRect,
  extrudeAlongX,
  extrudeUp,
  HelixCurve,
  hexNutGeometry,
  mergeAll,
  roundedBox,
  shellGeometry,
  threadedRodGeometry,
  washerGeometry,
} from './_em-geometry';
import { Pin, useSmooth } from './_em-kit';

type Variant = 'alavanca' | 'deslizante';
type Poles = 'spst' | 'spdt';

export interface ToggleSwitchProps {
  variant?: Variant;
  /** Lever (or slider) in the ON position. */
  on?: boolean;
  /** SPST (2 lugs) or SPDT (3 lugs); the slide switch is always SPDT. */
  poles?: Poles;
}

/** Panel toggle (mm). */
const T = {
  L: 20,
  W: 13,
  H: 19,
  lug: 9,
  lugW: 6.3,
  lugT: 0.8,
  lugX: 7,
  frame: 0.8,
  collar: 1,
  thread: 9,
  pivot: 21.4,
  bore: 4.4,
  lever: 20,
  angle: (18 * Math.PI) / 180,
  rockerY: 7,
  rockerAngle: (8 * Math.PI) / 180,
};
/** Height of the body bottom above the lug tips. */
export const TOGGLE_SEAT = T.lug;

/** Slide switch (mm). */
const S = { L: 8.6, W: 3.6, H: 3.6, pin: 3.5, pitch: 3, travel: 1, knob: 4 };

export const meta: PartMeta = {
  id: 'toggle-switch',
  label: 'Chave alavanca e chave deslizante',
  category: 'eletromecanicos',
  summary:
    'Chave alavanca de painel (bucha de 12 mm, porca e terminais de solda) e chave deslizante de placa, com o mecanismo por dentro.',
  defaults: { variant: 'alavanca', on: true, poles: 'spdt' },
  controls: {
    variant: {
      kind: 'select',
      label: 'Modelo',
      options: [
        { value: 'alavanca', label: 'Alavanca de painel' },
        { value: 'deslizante', label: 'Deslizante de placa' },
      ],
    },
    on: { kind: 'toggle', label: 'Ligada (ON)' },
    poles: {
      kind: 'select',
      label: 'Contatos',
      options: [
        { value: 'spdt', label: '1 polo, 2 posições (3 terminais)' },
        { value: 'spst', label: '1 polo, 1 posição (2 terminais)' },
      ],
    },
  },
  annotations: (p): PartAnnotation[] => {
    if (p.variant === 'deslizante') {
      return [
        { at: [0, 0, 0], text: 'Alavanca deslizante', anchor: 'alavanca' },
        { at: [-S.L / 2, S.pin + S.H, S.W / 2], text: 'Capa de aço', exploded: false },
        { at: [0, 0, 0], text: 'Pino comum (meio)', anchor: 'comum' },
        {
          at: [0, 0, 0],
          text: 'Ponte de contato: liga o meio a um dos lados',
          anchor: 'ponte',
          exploded: true,
        },
      ];
    }
    const lugs: Vec3 = [-T.lugX, T.lug * 0.4, T.lugT];
    return [
      { at: [0, 0, 0], text: 'Alavanca', anchor: 'alavanca' },
      {
        at: [T.bore + 2.5, T.lug + T.pivot + 3, 0],
        text: 'Bucha roscada de 12 mm: porca e arruela prendem no painel',
        anchor: 'bucha',
      },
      { at: lugs, text: 'Terminais de solda (ou faston 6,3 mm)', exploded: false },
      {
        at: [0, 0, 0],
        text: 'Gangorra de cobre: fecha o lado oposto ao da alavanca',
        anchor: 'gangorra',
        exploded: true,
      },
      {
        at: [0, 0, 0],
        text: 'Êmbolo com mola: dá o "clique" e segura a posição',
        anchor: 'mola',
        exploded: true,
      },
    ];
  },
  explode: true,
  cutaway: true,
  describe: (p) => {
    const on = !!p.on;
    if (p.variant === 'deslizante') {
      return `Chave deslizante de placa (1 polo, 2 posições), alavanca ${on ? 'do lado ON: o pino do meio liga ao pino da direita' : 'do lado OFF: o pino do meio liga ao pino da esquerda'}.`;
    }
    const spdt = p.poles !== 'spst';
    const state = on
      ? 'alavanca para a direita: o terminal do meio liga ao terminal da esquerda'
      : spdt
        ? 'alavanca para a esquerda: o terminal do meio liga ao terminal da direita'
        : 'alavanca para a esquerda: circuito aberto';
    return `Chave alavanca de painel com bucha de 12 mm, ${spdt ? '3 terminais (SPDT)' : '2 terminais (SPST)'}; ${state}.`;
  },
  view: [0.75, 0.55, 1.4],
};

export default function ToggleSwitch(props: ToggleSwitchProps) {
  const p = { ...meta.defaults, ...props } as Required<ToggleSwitchProps>;
  if (p.variant === 'deslizante') return <SlideSwitch on={!!p.on} />;
  return <PanelToggle on={!!p.on} spdt={p.poles !== 'spst'} />;
}

function PanelToggle({ on, spdt }: { on: boolean; spdt: boolean }) {
  const lever = useRef<Group>(null);
  const rocker = useRef<Group>(null);
  const noise = getNoiseTexture();
  const pivotY = T.pivot;
  // Plunger length so its tip rides on the tilted rocker.
  const reach =
    (pivotY - T.rockerY - 0.8) / (Math.cos(T.angle) - Math.sin(T.angle) * Math.tan(T.rockerAngle));

  useSmooth(
    [on ? 1 : -1],
    ([v]) => {
      const s = v!;
      if (lever.current) lever.current.rotation.z = -s * T.angle;
      // The rocker snaps over when the plunger passes the middle.
      const r = Math.max(-1, Math.min(1, s * 2.2));
      if (rocker.current) rocker.current.rotation.z = r * T.rockerAngle;
    },
    11,
  );

  const body = useDisposable(() => {
    const g = shellGeometry(T.L, T.H, T.W, 1.4, 1.1, 1, 1);
    g.rotateX(Math.PI);
    g.translate(0, T.H, 0);
    return g;
  }, []);

  const frame = useDisposable(() => {
    const parts: BufferGeometry[] = [];
    const top = new Shape();
    addRoundedRect(top, T.L + 0.6, T.W + 0.6, 1.2);
    const hole = new Path();
    hole.absarc(0, 0, 6.05, 0, Math.PI * 2, true);
    top.holes.push(hole);
    const plate = extrudeUp(top, T.frame, 0.2, { curveSegments: 10 });
    plate.translate(0, T.H, 0);
    parts.push(plate);
    // Straps down the short sides, crimped under the body.
    for (const side of [-1, 1]) {
      const strap = roundedBox(0.6, T.H * 0.62, 7, 0.2, 0.15);
      strap.translate(side * (T.L / 2 + 0.3), T.H * 0.38 + 0.2, 0);
      parts.push(strap);
    }
    return mergeAll(parts);
  }, []);

  const bushing = useDisposable(() => {
    const parts: BufferGeometry[] = [];
    const collar = new Shape();
    const R = 7.4 / Math.cos(Math.PI / 6);
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      if (i === 0) collar.moveTo(R * Math.cos(a), R * Math.sin(a));
      else collar.lineTo(R * Math.cos(a), R * Math.sin(a));
    }
    collar.closePath();
    const c = extrudeUp(collar, T.collar, 0.2, { bevelSegments: 1 });
    c.translate(0, T.H + T.frame, 0);
    parts.push(c);
    const rod = threadedRodGeometry(12, 0.75, T.thread, 64);
    rod.translate(0, T.H + T.frame + T.collar, 0);
    parts.push(rod);
    // Top face with the bore.
    const ring = axialLathe(
      [
        [T.bore, 0],
        [5.55, 0],
      ],
      48,
    );
    ring.rotateX(Math.PI);
    ring.translate(0, T.H + T.frame + T.collar + T.thread, 0);
    parts.push(ring);
    return mergeAll(parts);
  }, []);

  const bore = useDisposable(
    () =>
      axialLathe(
        [
          [T.bore, T.H + T.frame + T.collar + T.thread],
          [T.bore, T.pivot - 1],
          [0, T.pivot - 1],
        ],
        40,
      ),
    [],
  );

  const nut = useDisposable(() => hexNutGeometry(16, 2.6, 6.02, 0.35), []);
  const washer = useDisposable(() => washerGeometry(8.2, 6.1, 0.8), []);

  const leverGeometry = useDisposable(() => {
    const out = T.H + T.frame + T.collar + T.thread - pivotY;
    const pts: [number, number][] = [[0, -2.2]];
    pts.push([1.6, -2.2], [1.6, out + 1], [1.45, out + 2], [1.15, out + T.lever * 0.68]);
    // Bat end.
    const end = out + T.lever;
    for (let i = 0; i <= 10; i++) {
      const a = (Math.PI / 2) * (i / 10);
      pts.push([1.15 + 0.5 * Math.sin(a * 0.9), end - 4 + 4 * (i / 10)]);
    }
    for (let i = 1; i <= 8; i++) {
      const a = (Math.PI / 2) * (i / 8);
      pts.push([1.6 * Math.cos(a), end + 1.6 * Math.sin(a) * 0.9]);
    }
    return axialLathe(pts, 40);
  }, []);

  const springGeometry = useDisposable(
    () => tube(new HelixCurve(1.05, 6, 9, 0.3), 0.14, { radial: 6, segments: 240 }),
    [],
  );

  const lugGeometry = useDisposable(() => {
    const shape = new Shape();
    const w = T.lugW;
    const h = T.lug + 0.6;
    shape.moveTo(-w / 2 + 0.6, -h);
    shape.lineTo(w / 2 - 0.6, -h);
    shape.lineTo(w / 2, -h + 0.9);
    shape.lineTo(w / 2, 0.6);
    shape.lineTo(-w / 2, 0.6);
    shape.lineTo(-w / 2, -h + 0.9);
    shape.closePath();
    const hole = new Path();
    hole.absarc(0, -h + 3, 0.9, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    return extrudeAlongX(shape, T.lugT, 0.08, { curveSegments: 16 });
  }, []);

  const lugsX = spdt ? [-T.lugX, 0, T.lugX] : [-T.lugX, 0];
  const metal = { preset: 'brass' as const, color: '#d8c49a', roughness: 0.32 };
  const silver = { color: '#dddbd5', metalness: 1, roughness: 0.25 };
  // Top of the fixed contacts: where the tilted rocker's contact lands.
  const contactTop = T.rockerY - 5.5 * Math.sin(T.rockerAngle) - 0.35 * Math.cos(T.rockerAngle);
  const armY = contactTop - 0.7;

  return (
    <group position={[0, TOGGLE_SEAT, 0]}>
      {/* Body. */}
      <mesh geometry={body}>
        <Material
          color="#151515"
          roughness={0.32}
          roughnessMap={noise}
          clearcoat={0.4}
          clip
          cutColor="#0a0a0a"
        />
      </mesh>

      {/* Lugs and the contacts inside. */}
      <Explode offset={[0, -12, 0]}>
        {lugsX.map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh geometry={lugGeometry}>
              <Material {...metal} />
            </mesh>
            <mesh position={[0, (x === 0 ? T.rockerY - 0.5 : armY) / 2, 0]}>
              <boxGeometry args={[T.lugT, x === 0 ? T.rockerY - 0.5 : armY, 3]} />
              <Material {...metal} />
            </mesh>
            {x === 0 ? (
              <mesh position={[0, T.rockerY - 0.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.55, 0.55, 3, 16]} />
                <Material {...metal} />
              </mesh>
            ) : (
              <mesh position={[-Math.sign(x) * 1, armY, 0]}>
                <boxGeometry args={[2.8, 0.7, 3]} />
                <Material {...metal} />
              </mesh>
            )}
            {x !== 0 && (
              <mesh position={[Math.sign(x) * 5.5 - x, contactTop - 0.175, 0]}>
                <cylinderGeometry args={[0.9, 1, 0.35, 20]} />
                <Material {...silver} />
              </mesh>
            )}
          </group>
        ))}
      </Explode>

      {/* Rocker. */}
      <Explode offset={[0, 4, 0]} delay={0.2}>
        <group ref={rocker} position={[0, T.rockerY, 0]}>
          <mesh position={[0, 0.4, 0]}>
            <boxGeometry args={[13, 0.8, 3.6]} />
            <Material preset="copper" roughness={0.3} />
          </mesh>
          {[-5.5, 5.5].map((x) => (
            <mesh key={x} position={[x, -0.17, 0]}>
              <cylinderGeometry args={[0.9, 0.95, 0.35, 20]} />
              <Material {...silver} />
            </mesh>
          ))}
          <Anchor name="gangorra" position={[-4, 0.8, 1.8]} />
        </group>
      </Explode>

      {/* Frame, bushing and its bore. */}
      <Explode offset={[0, 10, 0]} delay={0.1}>
        <mesh geometry={frame}>
          <Material preset="nickel" roughness={0.3} roughnessMap={noise} />
        </mesh>
        <mesh geometry={bushing}>
          <Material preset="nickel" color="#cfcdc6" roughness={0.28} />
        </mesh>
        <mesh geometry={bore}>
          <Material color="#3a3a3a" metalness={1} roughness={0.5} />
        </mesh>
        <Anchor name="bucha" position={[6, T.H + 6, 0]} />
      </Explode>

      {/* Washer and nut. */}
      <Explode offset={[0, 20, 0]} delay={0.25}>
        <mesh geometry={washer} position={[0, T.H + T.frame + T.collar + 2.2, 0]}>
          <Material preset="steel" roughness={0.35} />
        </mesh>
        <mesh geometry={nut} position={[0, T.H + T.frame + T.collar + 3, 0]}>
          <Material preset="nickel" roughness={0.3} />
        </mesh>
      </Explode>

      {/* Lever with the plunger and spring underneath the pivot. */}
      <Explode offset={[0, 30, 0]} delay={0.3}>
        <group position={[0, pivotY, 0]}>
          <group ref={lever} rotation={[0, 0, -T.angle]}>
            <mesh geometry={leverGeometry}>
              <Material preset="chrome" roughness={0.1} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.6, 0.6, 9, 12]} />
              <Material preset="steel" />
            </mesh>
            {/* Actuator arm, spring and plunger. */}
            <mesh position={[0, -(reach - 3.5) / 2, 0]}>
              <cylinderGeometry args={[0.7, 0.9, reach - 3.5, 16]} />
              <Material preset="pbtBlack" />
            </mesh>
            <mesh geometry={springGeometry} position={[0, -reach + 1.2, 0]}>
              <Material preset="steel" color="#b9bcc0" roughness={0.3} />
            </mesh>
            <mesh position={[0, -reach + 1.5, 0]}>
              <cylinderGeometry args={[0.75, 0.75, 3, 16]} />
              <Material preset="brass" roughness={0.3} />
            </mesh>
            <mesh position={[0, -reach + 0.75, 0]}>
              <sphereGeometry args={[0.75, 16, 12]} />
              <Material preset="brass" roughness={0.3} />
            </mesh>
            <Anchor name="mola" position={[1.1, -reach + 4, 0]} />
            <Anchor
              name="alavanca"
              position={[1.6, T.H + T.frame + T.collar + T.thread - pivotY + T.lever * 0.6, 0]}
            />
          </group>
        </group>
      </Explode>
    </group>
  );
}

function SlideSwitch({ on }: { on: boolean }) {
  const slider = useRef<Group>(null);
  const noise = getNoiseTexture();
  useSmooth(
    [on ? S.travel : -S.travel],
    ([x]) => {
      if (slider.current) slider.current.position.x = x!;
    },
    14,
  );

  const base = useDisposable(() => roundedBox(S.L - 0.3, 1.5, S.W - 0.3, 0.25, 0.1), []);
  const cover = useDisposable(() => {
    const shell = shellGeometry(S.L, S.H - 1.2, S.W, 0.3, 0.25, 0.22, 0.22);
    shell.translate(0, 1.2, 0);
    // End tabs bent down over the base.
    const parts: BufferGeometry[] = [shell];
    for (const side of [-1, 1]) {
      const tab = roundedBox(0.22, 1.6, 1.6, 0.05, 0.05);
      tab.translate(side * (S.L / 2 - 0.11), -0.1, 0);
      parts.push(tab);
    }
    return mergeAll(parts);
  }, []);
  // The slot in the cover is suggested by a dark inset plate.
  const knob = useDisposable(() => {
    const parts: BufferGeometry[] = [];
    const a = roundedBox(1.5, S.knob + 1.1, 1.5, 0.25, 0.2);
    a.translate(0, 2.5, 0);
    parts.push(a);
    const b = roundedBox(3.2, 1.2, S.W - 0.8, 0.2, 0.1);
    b.translate(0, 1.5, 0);
    parts.push(b);
    return mergeAll(parts);
  }, []);

  return (
    <group position={[0, S.pin, 0]}>
      <mesh geometry={base}>
        <Material preset="pbtBlack" roughness={0.6} roughnessMap={noise} />
      </mesh>
      {[-1, 0, 1].map((i) => (
        <group key={i}>
          <Pin
            x={i * S.pitch}
            z={0}
            bottom={-S.pin}
            top={1.55}
            width={0.6}
            thickness={0.3}
            material={{ preset: 'tin', roughness: 0.3 }}
          />
          {i === 0 && <Anchor name="comum" position={[0, -S.pin * 0.5, 0.2]} />}
        </group>
      ))}
      {/* Contact pads at the top of each pin. */}
      {[-1, 0, 1].map((i) => (
        <mesh key={`pad${i}`} position={[i * S.pitch, 1.55, 0]}>
          <boxGeometry args={[1.4, 0.1, 1.6]} />
          <Material preset="tin" color="#e3e3df" roughness={0.25} />
        </mesh>
      ))}

      <Explode offset={[0, 9, 0]}>
        <mesh geometry={cover}>
          <Material
            preset="steel"
            color="#c8cacc"
            roughness={0.3}
            roughnessMap={noise}
            clip
            cutColor="#77797b"
          />
        </mesh>
        <mesh position={[0, S.H + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2 * S.travel + 1.7, 1.7]} />
          <Material color="#0d0d0d" roughness={0.8} polygonOffset polygonOffsetFactor={-2} clip />
        </mesh>
      </Explode>

      <group ref={slider} position={[on ? S.travel : -S.travel, 0, 0]}>
        <Explode offset={[0, 15, 0]} delay={0.15}>
          <mesh geometry={knob}>
            <Material preset="absBlack" roughness={0.45} />
          </mesh>
          <Anchor name="alavanca" position={[0.75, S.H + S.knob - 0.5, 0]} />
        </Explode>
        <Explode offset={[0, 4.5, 0]} delay={0.25}>
          {/* Bridge: two silver fingers that join two neighbouring pads. */}
          <mesh position={[0, 1.66, 0]}>
            <boxGeometry args={[S.pitch + 1.4, 0.12, 1.1]} />
            <Material color="#dcdad4" metalness={1} roughness={0.25} />
          </mesh>
          <Anchor name="ponte" position={[0, 1.8, 0.6]} />
        </Explode>
      </group>
    </group>
  );
}
