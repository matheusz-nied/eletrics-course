/**
 * Buzzers:
 * - active ("ativo"): Ø 12 × 9,5 mm magnetic buzzer with its own oscillator,
 *   sealed bottom, pins 7,6 mm apart (the + pin longer), "+" moulded on top
 *   and, optionally, the paper seal sticker used while the board is washed;
 * - passive ("passivo"): Ø 12 × 8,5 mm, open bottom showing the green board,
 *   needs a square wave to sound (typical 12085/12095 datasheets);
 * - piezo disc ("piezo"): Ø 27 mm brass disc with a Ø 20 mm white ceramic and
 *   its silver electrode, red and black wires soldered on.
 * Inside the magnetic ones: iron base, centre pole with the coil, ring magnet
 * and the steel diaphragm with its armature. Sounding: the diaphragm moves
 * and sound rings spread from the hole. Exploded view: housing, diaphragm,
 * magnet and coil lifted off the board. Cutaway: the housing and parts cut.
 */
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { DoubleSide, type Group, type Mesh, type MeshBasicMaterial } from 'three';
import { useReducedMotion } from '../core/motion';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { FONT_SANS, fitText, getNoiseTexture, useCanvasTexture } from '../materials/textures';
import type { PartAnnotation, PartMeta, PartProps, Vec3 } from '../types';
import {
  lathe,
  Lead,
  scaleUv,
  shellProfile,
  useGeometrySet,
  useTurnsTexture,
  WireSection,
} from './_power-shared';

type Variant = 'ativo' | 'passivo' | 'piezo';

export interface BuzzerProps {
  variant?: Variant;
  /** Driven: it sounds. */
  sounding?: boolean;
  /** Paper seal on the top of the active buzzer. */
  sticker?: boolean;
}

const R = 6;
const PITCH = 7.6;
const PIN_R = 0.3;
const DISC_R = 13.5;
const CERAMIC_R = 10;

function variantOf(p: PartProps): Variant {
  const v = String(p.variant);
  return v === 'passivo' || v === 'piezo' ? v : 'ativo';
}

/** Body height, the + and − pin lengths below the body, and the board's top (mm). */
function body(v: Variant) {
  return v === 'passivo'
    ? { H: 8.5, plus: 6.5, minus: 6.5, board: [0.2, 1.0] as const }
    : { H: 9.5, plus: 8, minus: 6, board: [0.7, 1.5] as const };
}

export const meta: PartMeta = {
  id: 'buzzer',
  label: 'Buzzer',
  category: 'saidas',
  summary:
    'Buzzer ativo, buzzer passivo e disco piezoelétrico: por fora e por dentro, com bobina, ímã e diafragma.',
  defaults: { variant: 'ativo', sounding: false, sticker: true },
  controls: {
    variant: {
      kind: 'select',
      label: 'Tipo',
      options: [
        { value: 'ativo', label: 'Ativo (com oscilador)' },
        { value: 'passivo', label: 'Passivo (precisa de onda quadrada)' },
        { value: 'piezo', label: 'Disco piezoelétrico' },
      ],
    },
    sounding: { kind: 'toggle', label: 'Tocando' },
    sticker: { kind: 'toggle', label: 'Adesivo de vedação (ativo)' },
  },
  annotations: (p) => {
    const v = variantOf(p);
    if (v === 'piezo') {
      const list: PartAnnotation[] = [
        {
          at: [DISC_R * 0.8, 0.2, DISC_R * 0.4],
          text: 'Disco de latão: fio preto',
          exploded: false,
        },
        {
          at: [CERAMIC_R * 0.55, 0.45, -CERAMIC_R * 0.55],
          text: 'Cerâmica piezoelétrica: se deforma com a tensão',
          exploded: false,
        },
        { at: [2, 0.45, 2], text: 'Eletrodo prateado: fio vermelho', exploded: false },
        { at: [0, 0, 0], text: 'Cerâmica com o eletrodo', anchor: 'ceramic', exploded: true },
        { at: [0, 0, 0], text: 'Disco de latão (vibra junto)', anchor: 'disc', exploded: true },
      ];
      return list;
    }
    const { H, plus } = body(v);
    const top = plus + H;
    const list: PartAnnotation[] = [
      { at: [0, top, 0], text: 'Furo por onde o som sai', exploded: false },
      {
        at: [4.2, top + 0.2, 1.5],
        text: v === 'ativo' ? 'Marca +: a perna mais longa' : 'Marca +',
        exploded: false,
      },
      {
        at: [-PITCH / 2, plus * 0.4, 0],
        text: 'Terminais a 7,6 mm: cabem na protoboard',
        exploded: false,
      },
      {
        at: [-R, plus + H * 0.6, 0],
        text:
          v === 'ativo'
            ? 'Ativo: tem oscilador dentro; basta ligar'
            : 'Passivo: precisa de uma onda quadrada',
        exploded: false,
      },
      {
        at: [0, 0, 0],
        text: 'Diafragma de aço: vibra e faz o som',
        anchor: 'diaphragm',
        exploded: true,
      },
      { at: [0, 0, 0], text: 'Ímã em anel', anchor: 'magnet', exploded: true },
      {
        at: [0, 0, 0],
        text: 'Bobina: puxa o diafragma a cada pulso',
        anchor: 'coil',
        exploded: true,
      },
      {
        at: [0, 0, 0],
        text: v === 'ativo' ? 'Placa com o oscilador' : 'Placa (aparece por baixo)',
        anchor: 'board',
        exploded: true,
      },
    ];
    if (v === 'ativo' && p.sticker)
      list.push({
        at: [-1.5, top + 0.1, 2.5],
        text: 'Adesivo: retire depois de lavar a placa',
        exploded: false,
      });
    return list;
  },
  explode: true,
  cutaway: true,
  animated: (p) => Boolean(p.sounding),
  describe: (p) => {
    const v = variantOf(p);
    const sound = p.sounding ? ' Está tocando: ondas de som saem dele.' : '';
    if (v === 'piezo')
      return `Disco piezoelétrico: disco de latão de 27 mm com uma cerâmica branca de 20 mm e o eletrodo prateado por cima; fio vermelho soldado no eletrodo e fio preto no latão. A tensão deforma a cerâmica e o disco vibra.${sound}`;
    if (v === 'passivo')
      return `Buzzer passivo preto, 12 mm de diâmetro e 8,5 mm de altura, com a placa verde aparente embaixo e dois terminais a 7,6 mm. Só toca com um sinal que liga e desliga (onda quadrada); a frequência do sinal é a nota.${sound}`;
    const sticker = p.sticker
      ? ' Um adesivo branco cobre o furo de cima; é retirado depois de soldar e lavar a placa.'
      : '';
    return `Buzzer ativo preto, 12 mm de diâmetro e 9,5 mm de altura, com o fundo selado e dois terminais a 7,6 mm; o positivo, marcado com +, é o mais longo. Tem oscilador dentro: toca com tensão contínua (em geral 5 V).${sticker}${sound}`;
  },
  view: [0.7, 0.8, 1.2],
};

export default function Buzzer(props: BuzzerProps) {
  const p = { ...meta.defaults, ...props } as Required<BuzzerProps>;
  const v = variantOf(p as unknown as PartProps);
  if (v === 'piezo') return <PiezoDisc sounding={p.sounding} />;
  return <MagneticBuzzer variant={v} sounding={p.sounding} sticker={p.sticker && v === 'ativo'} />;
}

/** Rings of sound spreading from a point (frozen with reduced motion). */
function SoundRings({
  position,
  r0,
  r1,
  rise,
}: {
  position: Vec3;
  r0: number;
  r1: number;
  rise: number;
}) {
  const reduced = useReducedMotion();
  const rings = useRef<(Mesh | null)[]>([]);
  const time = useRef(0);
  const place = () => {
    rings.current.forEach((mesh, i) => {
      if (!mesh) return;
      const s = (time.current * 0.9 + i / 3) % 1;
      const r = r0 + (r1 - r0) * s;
      mesh.scale.set(r, r, r);
      mesh.position.y = rise * s;
      (mesh.material as MeshBasicMaterial).opacity = 0.55 * (1 - s) * Math.min(s * 6, 1);
    });
  };
  useFrame((_, dt) => {
    if (!reduced) time.current += Math.min(dt, 0.05);
    place();
  });
  return (
    <group position={position}>
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          ref={(m) => {
            rings.current[i] = m;
          }}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={5}
        >
          <ringGeometry args={[0.93, 1, 64]} />
          <meshBasicMaterial
            color="#4f9be0"
            transparent
            opacity={0.4}
            depthWrite={false}
            side={DoubleSide}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function MagneticBuzzer({
  variant,
  sounding,
  sticker,
}: {
  variant: 'ativo' | 'passivo';
  sounding: boolean;
  sticker: boolean;
}) {
  const { H, plus, minus, board } = body(variant);
  const [b0, b1] = board;
  const noise = getNoiseTexture();
  // Stack of the magnetic circuit, from the top of the board.
  const yoke: [number, number] = [b1, b1 + 0.4];
  const coil: [number, number] = [yoke[1] + 0.05, yoke[1] + 2.7];
  const pole: [number, number] = [yoke[1], yoke[1] + 3.4];
  const magnet: [number, number] = [yoke[1], yoke[1] + 1.7];
  const diaphragmY = pole[1] + 0.3;

  const geo = useGeometrySet(() => {
    const outer: [number, number][] = [
      [R, 0],
      [R, H - 0.55],
      [R - 0.55, H],
      [1.0, H],
    ];
    const shell = shellProfile(outer, 0.6);
    shell.push(shell[0]!);
    const housing = lathe(shell, 56, { angle: 30 });
    // Ledge inside the housing that holds the diaphragm, on top of the magnet.
    const ledge = lathe(
      [
        [4.5, magnet[1]],
        [R - 0.58, magnet[1]],
        [R - 0.58, diaphragmY],
        [4.5, diaphragmY],
        [4.5, magnet[1]],
      ],
      48,
    );
    const coilGeo = scaleUv(
      lathe(
        [
          [1.35, coil[0]],
          [3.0, coil[0]],
          [3.0, coil[1]],
          [1.35, coil[1]],
          [1.35, coil[0]],
        ],
        40,
      ),
      1,
      (coil[1] - coil[0]) / (0.12 * 8),
    );
    const ring = lathe(
      [
        [3.6, magnet[0]],
        [5.3, magnet[0]],
        [5.3, magnet[1]],
        [3.6, magnet[1]],
        [3.6, magnet[0]],
      ],
      48,
    );
    return { housing, ledge, coil: coilGeo, ring };
  }, [H, magnet[0], magnet[1], coil[0], coil[1], diaphragmY]);

  const turnsMap = useTurnsTexture('color', '#b4582c');
  const stickerMap = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#f4f2ea';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1d1d1f';
      fitText(ctx, 'REMOVE SEAL', w / 2, h * 0.4, w * 0.78, h * 0.15, { weight: 800 });
      fitText(ctx, 'AFTER WASHING', w / 2, h * 0.6, w * 0.84, h * 0.15, { weight: 800 });
    },
    'buzzer-sticker',
    { width: 512, height: 512, fonts: [`800 40px ${FONT_SANS}`] },
  );

  // The diaphragm moves while it sounds (exaggerated so it shows).
  const diaphragm = useRef<Group>(null);
  const reduced = useReducedMotion();
  const clock = useRef(0);
  useFrame((_, dt) => {
    if (!diaphragm.current) return;
    clock.current += Math.min(dt, 0.05);
    diaphragm.current.position.y =
      sounding && !reduced ? Math.sin(clock.current * 2 * Math.PI * 7) * 0.12 : 0;
  });

  const lift = plus;
  const plusX = PITCH / 2;
  return (
    <group>
      {/* Pins (stay with the board). */}
      {[
        { x: plusX, len: plus },
        { x: -plusX, len: minus },
      ].map(({ x, len }) => (
        <mesh key={x} position={[x, lift - len + (len + b1) / 2, 0]}>
          <cylinderGeometry args={[PIN_R, PIN_R, len + b1, 12]} />
          <Material preset="tin" roughness={0.3} clip />
        </mesh>
      ))}

      <group position={[0, lift, 0]}>
        {/* Board, with pads underneath (seen on the passive one). */}
        <mesh position={[0, (b0 + b1) / 2, 0]}>
          <cylinderGeometry args={[R - 0.62, R - 0.62, b1 - b0, 40]} />
          <Material preset="solderMask" roughness={0.45} clip cutColor="#c3b47a" />
        </mesh>
        {[plusX, -plusX].map((x) => (
          <mesh key={x} position={[x, b0 - 0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.85, 20]} />
            <Material preset="solder" roughness={0.25} clip />
          </mesh>
        ))}
        {variant === 'ativo' && (
          <>
            {/* Potting under the board, and the oscillator's transistor and resistor. */}
            <mesh position={[0, b0 / 2, 0]}>
              <cylinderGeometry args={[R - 0.62, R - 0.62, b0 - 0.05, 40]} />
              <Material preset="epoxyBlack" roughness={0.7} roughnessMap={noise} clip />
            </mesh>
            <mesh position={[0, b1 + 0.45, -4.7]}>
              <boxGeometry args={[1.3, 0.9, 1.1]} />
              <Material preset="epoxyBlack" clip />
            </mesh>
            <mesh position={[0, b1 + 0.2, 4.6]}>
              <boxGeometry args={[1.6, 0.4, 0.8]} />
              <Material color="#1b1b1c" roughness={0.5} clip />
            </mesh>
          </>
        )}
        <Anchor name="board" position={[R * 0.7, b1, R * 0.4]} />

        {/* Coil on the iron base and centre pole. */}
        <Explode offset={[0, 5, 0]} delay={0.3}>
          <mesh position={[0, (yoke[0] + yoke[1]) / 2, 0]}>
            <cylinderGeometry args={[5.3, 5.3, yoke[1] - yoke[0], 40]} />
            <Material preset="steel" color="#7d8085" roughness={0.45} clip />
          </mesh>
          <mesh position={[0, (pole[0] + pole[1]) / 2, 0]}>
            <cylinderGeometry args={[1.25, 1.25, pole[1] - pole[0], 24]} />
            <Material preset="steel" color="#8d9095" roughness={0.4} clip />
          </mesh>
          <mesh geometry={geo.coil}>
            <Material preset="magnetWire" color="#ffffff" map={turnsMap} clip cutColor="#9c4a22" />
          </mesh>
          {[-1, 1].map((s) => (
            <WireSection
              key={s}
              width={1.65}
              height={coil[1] - coil[0]}
              wire={0.12}
              position={[s * 2.175, (coil[0] + coil[1]) / 2, 0.02]}
            />
          ))}
          <Anchor name="coil" position={[2.4, coil[1], 2]} />
        </Explode>

        {/* Ring magnet. */}
        <Explode offset={[0, 10, 0]} delay={0.2}>
          <mesh geometry={geo.ring}>
            <Material preset="ferrite" color="#38383b" roughness={0.75} roughnessMap={noise} clip />
          </mesh>
          <Anchor name="magnet" position={[4.8, magnet[1], 2]} />
        </Explode>

        {/* Diaphragm and its armature. */}
        <Explode offset={[0, 15.5, 0]} delay={0.1}>
          <group ref={diaphragm}>
            <mesh position={[0, diaphragmY + 0.075, 0]}>
              <cylinderGeometry args={[R - 0.62, R - 0.62, 0.15, 48]} />
              <Material preset="steel" color="#b9bcc0" roughness={0.3} clip cutColor="#6d7074" />
            </mesh>
            <mesh position={[0, diaphragmY + 0.15 + 0.25, 0]}>
              <cylinderGeometry args={[1.7, 1.7, 0.5, 32]} />
              <Material preset="steel" color="#9a9da1" roughness={0.35} clip />
            </mesh>
          </group>
          <Anchor name="diaphragm" position={[3.5, diaphragmY + 0.15, 3]} />
        </Explode>

        {/* Housing with the ledge, the + mark and the sticker. */}
        <Explode offset={[0, 28, 0]}>
          <mesh geometry={geo.housing}>
            <Material
              preset="absBlack"
              color="#151517"
              roughness={0.38}
              roughnessMap={noise}
              clip
              cutColor="#0e0e0f"
            />
          </mesh>
          <mesh geometry={geo.ledge}>
            <Material preset="absBlack" color="#151517" roughness={0.5} clip cutColor="#0e0e0f" />
          </mesh>
          {[0, Math.PI / 2].map((a) => (
            <mesh key={a} position={[4.2, H + 0.08, 1.5]} rotation={[0, a, 0]}>
              <boxGeometry args={[1.5, 0.16, 0.36]} />
              <Material preset="absBlack" color="#151517" roughness={0.35} clip />
            </mesh>
          ))}
          {sticker && (
            <mesh position={[0, H + 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[3.9, 40]} />
              <Material
                color="#ffffff"
                map={stickerMap}
                roughness={0.82}
                polygonOffset
                polygonOffsetFactor={-2}
                clip
              />
            </mesh>
          )}
        </Explode>

        {sounding && <SoundRings position={[0, H + 0.4, 0]} r0={1.5} r1={13} rise={5} />}
      </group>
    </group>
  );
}

function PiezoDisc({ sounding }: { sounding: boolean }) {
  const noise = getNoiseTexture();
  const brassT = 0.2;
  const ceramicT = 0.22;
  const top = brassT + ceramicT;
  const red: Vec3 = [-3.5, top + 0.35, 1.5];
  const black: Vec3 = [-DISC_R + 1.6, brassT + 0.35, -1.2];
  const ceramicGroup = useRef<Group>(null);
  const reduced = useReducedMotion();
  const clock = useRef(0);
  useFrame((_, dt) => {
    if (!ceramicGroup.current) return;
    clock.current += Math.min(dt, 0.05);
    ceramicGroup.current.scale.y =
      sounding && !reduced ? 1 + Math.sin(clock.current * 2 * Math.PI * 7) * 0.25 : 1;
  });

  return (
    <group>
      {/* Brass disc with the black wire. */}
      <mesh position={[0, brassT / 2, 0]}>
        <cylinderGeometry args={[DISC_R, DISC_R, brassT, 72]} />
        <Material
          preset="brass"
          color="#ecc985"
          roughness={0.42}
          roughnessMap={noise}
          clip
          cutColor="#a8873f"
        />
      </mesh>
      <mesh position={[black[0], brassT, black[2]]} scale={[1, 0.45, 1]}>
        <sphereGeometry args={[1.0, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Material preset="solder" roughness={0.2} clip />
      </mesh>
      <Lead
        points={[
          [black[0] + 0.3, brassT + 0.4, black[2]],
          [black[0] - 2, brassT + 0.6, black[2] - 0.4],
          [-DISC_R - 6, 0.55, -3.5],
          [-DISC_R - 30, 0.55, -6.5],
        ]}
        radius={0.55}
        color="#1d1d1f"
        strip={4}
        clip
      />
      <Anchor name="disc" position={[DISC_R * 0.8, brassT, DISC_R * 0.4]} />

      {/* Ceramic, electrode and the red wire. */}
      <Explode offset={[0, 7, 0]}>
        <group ref={ceramicGroup}>
          <mesh position={[0, brassT + ceramicT / 2, 0]}>
            <cylinderGeometry args={[CERAMIC_R, CERAMIC_R, ceramicT, 64]} />
            <Material
              preset="ceramicWhite"
              color="#f2efe6"
              roughness={0.6}
              roughnessMap={noise}
              clip
              cutColor="#e3dfd2"
            />
          </mesh>
          <mesh position={[0, top + 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[CERAMIC_R - 0.6, 64]} />
            <Material preset="aluminum" color="#e2e3e5" roughness={0.55} clip />
          </mesh>
        </group>
        <mesh position={[red[0], top, red[2]]} scale={[1, 0.45, 1]}>
          <sphereGeometry args={[1.0, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <Material preset="solder" roughness={0.2} clip />
        </mesh>
        <Lead
          points={[
            [red[0] - 0.3, top + 0.4, red[2]],
            [red[0] - 3, top + 0.7, red[2] + 0.5],
            [-DISC_R - 6, 0.55, 3.5],
            [-DISC_R - 30, 0.55, 6.5],
          ]}
          radius={0.55}
          color="#c42a1f"
          strip={4}
          clip
        />
        <Anchor name="ceramic" position={[CERAMIC_R * 0.6, top, CERAMIC_R * 0.5]} />
      </Explode>

      {sounding && <SoundRings position={[0, top + 0.5, 0]} r0={4} r1={26} rise={9} />}
    </group>
  );
}
