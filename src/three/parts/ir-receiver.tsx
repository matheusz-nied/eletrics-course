/**
 * Infrared receiver module for 38 kHz remote controls, in the common
 * three-lead moulded package of TV receivers (the VS1838B / TSOP48xx class):
 * black epoxy body 6,0 × 7,0 × 3,2 mm with a hemispherical lens on the front
 * (sphere radius 2,6 mm, standing 1,8 mm out of the face, total depth 5 mm),
 * three 0,5 × 0,4 mm leads at 2,54 mm. Dimensions from typical datasheets of
 * this package. Optionally the bent sheet-steel shield of the metal-cased
 * variants, with a round window for the lens and its own ground leg.
 *
 * Inside, on the lead frame: the PIN photodiode die right behind the lens and
 * the receiver chip under it (amplifier, automatic gain control, 38 kHz
 * band-pass filter and demodulator), joined by gold bond wires. The dark
 * epoxy is the optical filter: it passes infrared (about 940 nm) and blocks
 * most visible light.
 */
import { ExtrudeGeometry, Path, Shape } from 'three';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { getNoiseTexture } from '../materials/textures';
import { axialLathe } from '../shapes/geometry';
import { useDisposable } from '../shapes/Wire';
import type { PartAnnotation, PartMeta, PartProps, Vec3 } from '../types';
import { boxAt } from './_remote-geometry';
import { bondWires, mergeAll, moldedBlock } from './_semi-geometry';
import { SiliconDie } from './_semi-parts';

export interface IrReceiverProps {
  /** Sheet-steel shield (metal-cased variants). */
  shield?: boolean;
  /** An IR remote is sending: the output pulses (not visible: the description says so). */
  receiving?: boolean;
  /** Length of the leads below the body (mm). */
  leadLength?: number;
}

const BODY = { w: 6, h: 7, d: 3.2 };
const FRONT = BODY.d / 2;
/** Lens: spherical cap, sphere radius 2,6 mm, 1,8 mm out of the front face. */
const LENS = { R: 2.6, rise: 1.8, y: 4.4 };
const LENS_BASE = Math.sqrt(LENS.R ** 2 - (LENS.R - LENS.rise) ** 2);
const PITCH = 2.54;
const LEAD = { w: 0.5, t: 0.4 };
/** Lead frame plane (z of its centre) and dies: photodiode behind the lens, chip below. */
const DIE_T = 0.25;
const FRAME_T = 0.25;
const DIE_Z = FRONT - 0.6 - DIE_T;
const FRAME_Z = DIE_Z - FRAME_T / 2;
const PHOTO: [number, number] = [1.5, 1.5];
const CHIP: [number, number] = [1.3, 1.0];
const CHIP_Y = 2.15;
const SHIELD = { t: 0.2, half: 3.25, back: -1.85, bottom: 0.8, top: 7.25, window: 2.6 };

/** Pin order of the usual package, seen from the lens side, left to right. */
const PINS = ['saída', 'GND', 'VCC'];

const resolve = (props: PartProps) => ({ ...meta.defaults, ...props });
const leadOf = (v: unknown) => Math.max(Number(v) || 0, 3);

export const meta: PartMeta = {
  id: 'ir-receiver',
  label: 'Receptor infravermelho (38 kHz)',
  category: 'sensores',
  summary:
    'Receptor de controle remoto de três terminais: lente escura, fotodiodo e um chip que amplifica, filtra os 38 kHz e entrega os bits já demodulados.',
  defaults: { shield: false, receiving: false, leadLength: 12 },
  controls: {
    shield: { kind: 'toggle', label: 'Blindagem de metal' },
    receiving: { kind: 'toggle', label: 'Recebendo sinal do controle' },
    leadLength: { kind: 'number', label: 'Terminais', min: 4, max: 30, step: 1, unit: 'mm' },
  },
  annotations: (props) => {
    const p = resolve(props);
    const y0 = leadOf(p.leadLength);
    const list: PartAnnotation[] = [
      {
        at: [0, 0, 0],
        anchor: 'lente',
        text: 'Lente: o plástico escuro deixa passar o infravermelho e barra boa parte da luz visível',
      },
      {
        at: [0, 0, 0],
        anchor: 'fotodiodo',
        text: 'Fotodiodo: transforma o infravermelho em corrente',
      },
      {
        at: [0, 0, 0],
        anchor: 'chip',
        text: 'Chip: amplifica, filtra os 38 kHz e entrega os bits já demodulados',
      },
      {
        at: [0, Math.min(3, y0 * 0.3), FRAME_Z] as Vec3,
        text: 'Três terminais: saída, GND e VCC (a ordem muda de modelo para modelo: confira a folha de dados)',
        exploded: false,
      },
    ];
    if (p.receiving)
      list.push({
        at: [-PITCH, Math.min(y0 * 0.65, y0 - 1.5), FRAME_Z] as Vec3,
        text: 'Saída: fica em VCC e cai para 0 V enquanto chega uma rajada de 38 kHz',
        exploded: false,
      });
    if (p.shield)
      list.push({
        at: [0, 0, 0],
        anchor: 'blindagem',
        text: 'Blindagem de aço ligada ao GND: barra interferência elétrica',
      });
    return list;
  },
  explode: true,
  cutaway: true,
  // Cut parallel to the front, just in front of the dies: the lens comes off.
  cut: { normal: [0, 0, -1], through: [0, 0, DIE_Z + DIE_T + 0.08] },
  describe: (props) => {
    const p = resolve(props);
    const shield = p.shield ? ', com blindagem de aço e uma janela redonda para a lente' : '';
    const pins = PINS.map((name, i) => `${i + 1} ${name}`).join(', ');
    const state = p.receiving
      ? 'Agora ele está recebendo um controle remoto: a luz infravermelha, invisível ao olho, chega piscando 38 mil vezes por segundo em rajadas, e a saída cai para 0 V a cada rajada, entregando os bits do comando.'
      : 'Sem sinal de controle remoto, a saída fica parada em VCC.';
    return `Receptor infravermelho de 38 kHz com corpo de epóxi preto e lente em domo na frente${shield}. Três terminais: ${pins}, vistos de frente para a lente (a ordem pode mudar de modelo para modelo). ${state}`;
  },
  view: [0.95, 0.5, 1.45],
};

export default function IrReceiver(props: IrReceiverProps) {
  const p = resolve(props as PartProps);
  const y0 = leadOf(p.leadLength);
  const shield = p.shield === true;
  const noise = getNoiseTexture();

  const body = useDisposable(
    () =>
      moldedBlock({
        width: BODY.w,
        depth: BODY.d,
        height: BODY.h,
        corner: 0.45,
        fillet: 0.45,
        bottomFillet: 0.2,
        draft: 0.02,
        parting: BODY.h * 0.4,
      }),
    [],
  );

  const lens = useDisposable(() => {
    const profile: [number, number][] = [[LENS_BASE + 0.05, -0.05]];
    const a0 = Math.asin(LENS_BASE / LENS.R);
    for (let i = 0; i <= 16; i++) {
      const a = a0 * (1 - i / 16);
      profile.push([LENS.R * Math.sin(a), LENS.R * Math.cos(a) - (LENS.R - LENS.rise)]);
    }
    const g = axialLathe(profile, 48);
    g.rotateX(Math.PI / 2);
    g.translate(0, LENS.y, FRONT);
    return g;
  }, []);

  const leads = useDisposable(() => {
    const parts = [-1, 0, 1].flatMap((s) => [
      boxAt(s * PITCH, (y0 + 0.6) / 2, FRAME_Z, LEAD.w, y0 + 0.6, LEAD.t),
      // Wider shoulder where the lead enters the body.
      boxAt(s * PITCH, y0 - 0.5, FRAME_Z, 0.8, 1, LEAD.t),
    ]);
    return mergeAll(parts);
  }, [y0]);

  // Lead frame inside the body: the outer leads end in short posts, GND carries the paddle.
  const frame = useDisposable(
    () =>
      mergeAll([
        boxAt(-PITCH, y0 + 0.95, FRAME_Z, 0.7, 0.9, FRAME_T),
        boxAt(PITCH, y0 + 0.95, FRAME_Z, 0.7, 0.9, FRAME_T),
        boxAt(0, y0 + 0.9, FRAME_Z, 0.6, 0.8, FRAME_T),
        boxAt(0, y0 + 3.6, FRAME_Z, 2.6, 4.6, FRAME_T),
      ]),
    [y0],
  );

  const wires = useDisposable(() => {
    const top = DIE_Z + DIE_T;
    const post = FRAME_Z + FRAME_T / 2;
    const cy = y0 + CHIP_Y;
    const py = y0 + LENS.y;
    return bondWires(
      [
        // Photodiode anode and cathode to the chip input.
        { from: [-0.45, py - 0.55, top], to: [-0.3, cy + 0.32, top], loop: 0.3 },
        { from: [0.45, py - 0.55, top], to: [0.3, cy + 0.32, top], loop: 0.3 },
        // Chip to OUT, VCC and GND.
        { from: [-0.48, cy - 0.3, top], to: [-PITCH + 0.1, y0 + 1.2, post], loop: 0.3 },
        { from: [0.48, cy - 0.3, top], to: [PITCH - 0.1, y0 + 1.2, post], loop: 0.3 },
        { from: [0, cy - 0.36, top], to: [0, y0 + 1.15, post], loop: 0.22 },
      ],
      0.02,
      [0, 0, 1],
    );
  }, [y0]);

  const shell = useDisposable(() => {
    const { t, half, back, bottom, top, window } = SHIELD;
    const h = top - bottom;
    const plate = new Shape();
    plate.moveTo(-half, bottom);
    plate.lineTo(half, bottom);
    plate.lineTo(half, top);
    plate.lineTo(-half, top);
    plate.closePath();
    const hole = new Path();
    hole.absarc(0, LENS.y, window, 0, Math.PI * 2, true);
    plate.holes.push(hole);
    const front = new ExtrudeGeometry(plate, { depth: t, bevelEnabled: false, curveSegments: 24 });
    front.translate(0, 0, FRONT + 0.05);
    const depth = FRONT + 0.05 + t - back;
    return mergeAll([
      front,
      boxAt(0, top - t / 2, back + depth / 2, half * 2, t, depth),
      boxAt(0, bottom + h / 2, back + t / 2, half * 2, h, t),
      // Side tabs folded forward over the body.
      ...[-1, 1].map((s) => boxAt(s * (half - t / 2), bottom + 1.3, back + 0.7, t, 1.6, 1.4)),
      // Ground leg.
      boxAt(0, (bottom + 0.4 - y0) / 2, back + t / 2, 0.7, bottom + 0.4 + y0, t),
    ]);
  }, [y0]);

  return (
    <group>
      {/* Epoxy body and lens: one moulding. */}
      <Explode offset={[0, BODY.h + 4, 0]}>
        <group position={[0, y0, 0]}>
          <mesh geometry={body}>
            <Material
              preset="epoxyBlack"
              clip
              color="#151517"
              roughness={0.5}
              roughnessMap={noise}
              cutColor="#2b2a30"
            />
          </mesh>
          <mesh geometry={lens}>
            <Material
              preset="epoxyBlack"
              clip
              color="#111113"
              roughness={0.12}
              clearcoat={1}
              clearcoatRoughness={0.06}
              cutColor="#2b2a30"
            />
          </mesh>
          <Anchor
            name="lente"
            position={[LENS_BASE * 0.55, LENS.y + LENS_BASE * 0.5, FRONT + 1.2]}
          />
        </group>
      </Explode>

      {/* Lead frame, dies and bond wires stay in place. */}
      <mesh geometry={frame}>
        <Material preset="copper" color="#c98a64" roughness={0.35} />
      </mesh>
      <SiliconDie
        size={PHOTO}
        thickness={DIE_T}
        kind="led"
        seed={5}
        position={[0, y0 + LENS.y, DIE_Z]}
        rotation={[Math.PI / 2, 0, 0]}
      />
      <SiliconDie
        size={CHIP}
        thickness={DIE_T}
        kind="ic"
        pads={6}
        seed={21}
        position={[0, y0 + CHIP_Y, DIE_Z]}
        rotation={[Math.PI / 2, 0, 0]}
      />
      <Anchor name="fotodiodo" position={[PHOTO[0] * 0.3, y0 + LENS.y + 0.3, DIE_Z + DIE_T]} />
      <Anchor name="chip" position={[CHIP[0] * 0.3, y0 + CHIP_Y, DIE_Z + DIE_T]} />
      <mesh geometry={wires}>
        <Material preset="gold" />
      </mesh>
      <mesh geometry={leads}>
        <Material preset="tin" roughness={0.3} />
      </mesh>

      {shield && (
        <Explode offset={[0, BODY.h * 2 + 9, -2]}>
          <group position={[0, y0, 0]}>
            <mesh geometry={shell}>
              <Material preset="tin" color="#cfd2d4" roughness={0.32} clip cutColor="#8d9093" />
            </mesh>
            <Anchor name="blindagem" position={[SHIELD.half, SHIELD.top, 0]} />
          </group>
        </Explode>
      )}
    </group>
  );
}
