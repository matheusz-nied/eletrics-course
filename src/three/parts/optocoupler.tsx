/**
 * Optocouplers in DIP packages: DIP-4 with a phototransistor output (PC817
 * style: 1 anode, 2 cathode, 3 emitter, 4 collector) and DIP-6 with a
 * photo-triac output (MOC3021 style: 1 anode, 2 cathode, 4 and 6 main
 * terminals, 3 and 5 not connected). Dimensions from typical datasheets
 * (PC817, MOC3020–MOC3023 outlines): black body 4,6 × 6,5 mm (DIP-4) or
 * 8,9 × 6,5 mm (DIP-6), 3,5 mm thick on a 0,5 mm standoff, leads 2,54 mm
 * apart in rows 7,62 mm apart, pin-1 dot. Inside, the face-to-face
 * construction: the infrared LED die hangs under the raised input lead
 * frame, about 0,6 mm above the detector die on the output lead frame,
 * across a clear silicone light pipe. No metal joins the two sides: only
 * light crosses (isolation of thousands of volts).
 */
import { Anchor, Explode, useView } from '../core/view';
import { emission, GlowSprite } from '../fx/glow';
import { Material } from '../materials/Material';
import { getNoiseTexture, useCanvasTexture } from '../materials/textures';
import { axialLathe } from '../shapes/geometry';
import { useDisposable } from '../shapes/Wire';
import type { PartMeta, PartProps, Vec3 } from '../types';
import { attachPads, dipLeadRow, fingerOutline, plates, rectOutline } from './_opto-geometry';
import { bentStrip, bondWires, mergeAll, moldedBlock, type Pt } from './_semi-geometry';
import { random, usePrintedTop } from './_semi-parts';

type Package = 'dip4' | 'dip6';

export interface OptocouplerProps {
  package?: Package;
  /** Printed part number; empty = PC817 (DIP-4) or MOC3021 (DIP-6). */
  code?: string;
  /** Input LED on: the IR die glows faintly in the cut view (IR itself is invisible). */
  active?: boolean;
}

const PITCH = 2.54;
const ROW = 7.62;
const BODY_W = 6.5;
const BODY_H = 3.5;
const STANDOFF = 0.5;
const PIN_L = 3.3;
const LEAD_T = 0.25;
const SHOULDER_W = 1.3;
const PIN_W = 0.5;
const PARTING = 1.4;
/** The input frame is bent up by this much: the LED faces the detector from above. */
const RISE = 1.3;
const BODY_Y = PIN_L + STANDOFF;
const FRAME_Y = BODY_Y + PARTING;
const UPPER_Y = FRAME_Y + RISE;
const EDGE = BODY_W / 2 - 0.05;
/** Infrared as a camera sensor shows it: a dim red-violet. */
const IR_TINT = '#c23ad8';
/** The cutaway keeps x < CUT_X. */
const CUT_X = 0.25;

interface Layout {
  length: number;
  code: string;
  /** X of the input leads that go up to the LED level (anode, cathode). */
  joggles: number[];
  /** Upper-level plates (LED paddle on the cathode, anode finger). */
  upper: Pt[][];
  /** Input leads with no internal connection (short anchoring stubs). */
  inputStubs: Pt[][];
  led: number;
  /** Where the LED's bond wire lands under the anode finger. */
  ledWire: Pt;
  output: Pt[][];
  detector: { size: [number, number]; kind: 'transistor' | 'triac'; pad: Pt; wire: Pt };
  /** Light pipe radii: at the detector, at the LED, and the bulge. */
  pipe: [number, number, number];
}

const DIP4: Layout = {
  length: 4.6,
  code: 'PC817',
  joggles: [-PITCH / 2, PITCH / 2],
  upper: [
    // Pin 2 (cathode) carries the LED paddle; pin 1 (anode) takes its wire.
    fingerOutline(
      [
        [PITCH / 2, 1.5],
        [PITCH / 2, 1.15],
        [0.42, 0.4],
      ],
      [0.9, 0.75, 0.6],
    ),
    rectOutline([-0.5, -0.5, 0.5, 0.5]),
    fingerOutline(
      [
        [-PITCH / 2, 1.5],
        [-PITCH / 2, 1.15],
        [-0.85, 0.98],
      ],
      [0.9, 0.75, 0.6],
    ),
  ],
  inputStubs: [],
  led: 0.36,
  ledWire: [-0.88, 1.05],
  output: [
    // Pin 4 (collector) carries the detector; pin 3 (emitter) takes its wire.
    fingerOutline(
      [
        [-PITCH / 2, -EDGE],
        [-PITCH / 2, -1.9],
        [-0.45, -0.75],
      ],
      [0.9, 0.8, 0.7],
    ),
    rectOutline([-0.7, -0.7, 0.7, 0.7]),
    fingerOutline(
      [
        [PITCH / 2, -EDGE],
        [PITCH / 2, -1.9],
        [0.95, -1.3],
      ],
      [0.9, 0.8, 0.6],
    ),
  ],
  detector: { size: [0.78, 0.78], kind: 'transistor', pad: [-0.14, -0.16], wire: [1.0, -1.4] },
  pipe: [0.95, 0.72, 0.22],
};

const DIP6: Layout = {
  length: 8.9,
  code: 'MOC3021',
  joggles: [-PITCH, 0],
  upper: [
    fingerOutline(
      [
        [0, 1.5],
        [0, 0.45],
      ],
      [0.9, 0.75],
    ),
    rectOutline([-0.55, -0.55, 0.55, 0.55]),
    fingerOutline(
      [
        [-PITCH, 1.5],
        [-PITCH, 1.1],
        [-1.3, 1.0],
      ],
      [0.9, 0.8, 0.6],
    ),
  ],
  // Pin 3: not connected.
  inputStubs: [rectOutline([PITCH - 0.45, 2.3, PITCH + 0.45, EDGE])],
  led: 0.4,
  ledWire: [-1.35, 1.05],
  output: [
    // Pin 6 carries the photo-triac; pin 4 takes its wire; pin 5 is a stub.
    fingerOutline(
      [
        [-PITCH, -EDGE],
        [-PITCH, -1.9],
        [-0.7, -0.55],
      ],
      [0.9, 0.8, 0.8],
    ),
    rectOutline([-0.85, -0.75, 0.85, 0.75]),
    fingerOutline(
      [
        [PITCH, -EDGE],
        [PITCH, -1.9],
        [1.5, -1.15],
      ],
      [0.9, 0.8, 0.6],
    ),
    rectOutline([-0.45, -EDGE, 0.45, -2.3]),
  ],
  detector: { size: [1.15, 0.95], kind: 'triac', pad: [-0.12, -0.2], wire: [1.55, -1.25] },
  pipe: [1.15, 0.85, 0.22],
};

/** Heights inside the package. */
const DET_BOTTOM = FRAME_Y + LEAD_T / 2 + 0.02;
const DET_T = 0.25;
const DET_TOP = DET_BOTTOM + DET_T;
const LED_T = 0.18;
const LED_TOP = UPPER_Y - LEAD_T / 2 - 0.02; // the LED's back, glued under the paddle
const LED_FACE = LED_TOP - LED_T; // its emitting face, looking down
const PIPE_MID = (FRAME_Y + LEAD_T / 2 + UPPER_Y - LEAD_T / 2) / 2;

export const meta: PartMeta = {
  id: 'optocoupler',
  label: 'Optoacoplador',
  category: 'semicondutores',
  summary:
    'Optoacoplador em DIP-4 (saída a fototransistor, como o PC817) ou DIP-6 (saída a fototriac, como o MOC3021): por dentro, um LED infravermelho olha para o detector através de silicone transparente, sem nenhuma ligação elétrica entre os dois lados.',
  defaults: { package: 'dip4', code: '', active: false },
  controls: {
    package: {
      kind: 'select',
      label: 'Encapsulamento',
      options: [
        { value: 'dip4', label: 'DIP-4, saída a fototransistor (PC817)' },
        { value: 'dip6', label: 'DIP-6, saída a fototriac (MOC3021)' },
      ],
    },
    code: { kind: 'text', label: 'Código impresso (vazio = o típico)', maxLength: 10 },
    active: { kind: 'toggle', label: 'LED de entrada aceso' },
  },
  annotations: (p) => {
    const six = packageOf(p) === 'dip6';
    const L = layoutOf(p);
    const x = (i: number) => (i - (six ? 1 : 0.5)) * PITCH;
    const front = ROW / 2;
    const top = BODY_Y + BODY_H;
    const pins = six
      ? [
          { at: [x(0), 1, front], text: 'Pino 1: ânodo do LED (+)' },
          { at: [x(1), 1, front], text: 'Pino 2: cátodo do LED (−)' },
          { at: [x(0), 1, -front], text: 'Pinos 6 e 4: os terminais do fototriac' },
          { at: [x(1), 1, -front], text: 'Pinos 3 e 5: sem ligação' },
        ]
      : [
          { at: [x(0), 1, front], text: 'Pino 1: ânodo do LED (+)' },
          { at: [x(1), 1, front], text: 'Pino 2: cátodo do LED (−)' },
          { at: [x(0), 1, -front], text: 'Pino 4: coletor do fototransistor' },
          { at: [x(1), 1, -front], text: 'Pino 3: emissor do fototransistor' },
        ];
    const detector = six ? 'Fototriac' : 'Fototransistor';
    return [
      ...pins.map((n) => ({ at: n.at as Vec3, text: n.text, exploded: false })),
      {
        at: [-L.length / 2 + 0.85, top, BODY_W / 2 - 0.85] as Vec3,
        text: 'Ponto: marca o pino 1',
        exploded: false,
      },
      {
        at: [0, 0, 0] as Vec3,
        text: p.active
          ? 'LED infravermelho aceso: luz invisível ao olho'
          : 'LED infravermelho: a entrada',
        anchor: 'led',
      },
      {
        at: [0, 0, 0] as Vec3,
        text: p.active
          ? `${detector} iluminado: a saída conduz`
          : `${detector}: a saída, conduz quando recebe luz`,
        anchor: 'detector',
      },
      {
        at: [0, 0, 0] as Vec3,
        text: 'Silicone transparente: a luz passa, a corrente não',
        anchor: 'gap',
      },
      {
        at: [0, 0, 0] as Vec3,
        text: 'Corpo opaco: bloqueia a luz de fora',
        anchor: 'body',
        exploded: true,
      },
    ];
  },
  explode: true,
  cutaway: true,
  // Half section just right of the middle (frames, leads and wires are cut
  // too, the dies stay whole): the LED above, the detector below.
  cut: { normal: [-1, 0, 0], through: [CUT_X, 0, 0] },
  describe: (p) => {
    const code = codeOf(p);
    const on = !!p.active;
    if (packageOf(p) === 'dip6') {
      return `Optoacoplador ${code} (DIP-6) com saída a fototriac. O LED infravermelho (pinos 1 e 2) dispara o fototriac (pinos 6 e 4) através de silicone transparente: não há ligação elétrica entre entrada e saída. Os pinos 3 e 5 ficam sem ligação. ${on ? 'LED aceso: o fototriac dispara e conduz.' : 'LED apagado: o fototriac fica bloqueado.'}`;
    }
    return `Optoacoplador ${code} (DIP-4) com saída a fototransistor. O LED infravermelho (pinos 1 e 2) ilumina o fototransistor (coletor no pino 4, emissor no pino 3) através de silicone transparente: não há ligação elétrica entre entrada e saída. ${on ? 'LED aceso: o fototransistor conduz.' : 'LED apagado: o fototransistor não conduz.'}`;
  },
  view: [1.0, 0.8, 1.2],
};

function packageOf(p: PartProps): Package {
  return p.package === 'dip6' ? 'dip6' : 'dip4';
}

function layoutOf(p: PartProps): Layout {
  return packageOf(p) === 'dip6' ? DIP6 : DIP4;
}

function codeOf(p: PartProps): string {
  return String(p.code ?? '').trim() || layoutOf(p).code;
}

export default function Optocoupler(props: OptocouplerProps) {
  const p = { ...meta.defaults, ...props } as Required<OptocouplerProps>;
  const pp = p as unknown as PartProps;
  const L = layoutOf(pp);
  const six = packageOf(pp) === 'dip6';
  const code = codeOf(pp);
  const { cutaway } = useView();
  const xs = six ? [-PITCH, 0, PITCH] : [-PITCH / 2, PITCH / 2];

  const body = useDisposable(
    () =>
      moldedBlock({
        width: L.length,
        depth: BODY_W,
        height: BODY_H,
        corner: 0.3,
        fillet: 0.32,
        bottomFillet: 0.25,
        draft: 0.08,
        parting: PARTING,
      }),
    [L.length],
  );

  const leadRow = (side: 1 | -1) =>
    dipLeadRow({
      xs,
      side,
      edge: EDGE,
      row: ROW,
      frameY: FRAME_Y,
      seat: PIN_L,
      thickness: LEAD_T,
      shoulder: SHOULDER_W,
      pin: PIN_W,
    });
  const inputLeads = useDisposable(() => leadRow(1), [six]);
  const outputLeads = useDisposable(() => leadRow(-1), [six]);

  // Input frame: straight in at the parting line, joggled up, then the LED level.
  const inputFrame = useDisposable(() => {
    const parts = L.joggles.map((x) => {
      const g = bentStrip(
        [
          [EDGE, FRAME_Y],
          [2.35, FRAME_Y],
          [1.8, UPPER_Y],
          [1.42, UPPER_Y],
        ],
        LEAD_T,
        0.9,
        0.3,
      );
      g.rotateY(-Math.PI / 2);
      g.translate(x, 0, 0);
      return g;
    });
    const upper = plates(L.upper, LEAD_T);
    upper.translate(0, UPPER_Y, 0);
    parts.push(upper);
    if (L.inputStubs.length) {
      const stubs = plates(L.inputStubs, LEAD_T);
      stubs.translate(0, FRAME_Y, 0);
      parts.push(stubs);
    }
    return mergeAll(parts);
  }, [six]);

  const outputFrame = useDisposable(() => {
    const g = plates(L.output, LEAD_T);
    g.translate(0, FRAME_Y, 0);
    return g;
  }, [six]);

  const ledGlue = useDisposable(
    () => attachPads([{ at: [0, 0], size: [L.led + 0.1, L.led + 0.1] }], LED_TOP + 0.01, 0.02),
    [six],
  );
  const detectorGlue = useDisposable(
    () =>
      attachPads(
        [{ at: [0, 0], size: [L.detector.size[0] + 0.12, L.detector.size[1] + 0.12] }],
        DET_BOTTOM - 0.01,
        0.02,
      ),
    [six],
  );

  const ledWire = useDisposable(
    () =>
      bondWires(
        [
          {
            from: [0, LED_FACE, 0],
            to: [L.ledWire[0], UPPER_Y - LEAD_T / 2, L.ledWire[1]],
            loop: 0.2,
          },
        ],
        0.02,
        [0, -1, 0],
      ),
    [six],
  );
  const detectorWire = useDisposable(
    () =>
      bondWires(
        [
          {
            from: [L.detector.pad[0], DET_TOP, L.detector.pad[1]],
            to: [L.detector.wire[0], FRAME_Y + LEAD_T / 2, L.detector.wire[1]],
            loop: 0.3,
          },
        ],
        0.02,
      ),
    [six],
  );

  // Clear silicone light pipe between the two dies.
  const pipe = useDisposable(() => {
    const [rBottom, rTop, bulge] = L.pipe;
    const y0 = FRAME_Y + LEAD_T / 2;
    const y1 = UPPER_Y - LEAD_T / 2;
    const profile: [number, number][] = [[0, y0]];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      profile.push([
        rBottom + (rTop - rBottom) * t + bulge * Math.sin(Math.PI * t),
        y0 + (y1 - y0) * t,
      ]);
    }
    profile.push([0, y1]);
    return axialLathe(profile, 40);
  }, [six]);

  const marking = usePrintedTop({
    width: L.length,
    height: BODY_W,
    lines: [
      { text: code, size: six ? 1.05 : 0.85, weight: 700 },
      { text: '2341', size: six ? 0.75 : 0.62, mono: true, weight: 600 },
    ],
    dimple: { x: 0.85, y: BODY_W - 0.85, d: 0.7 },
    offset: [six ? 0.4 : 0.2, -0.1],
  });
  const noise = getNoiseTexture();

  const lit = p.active && cutaway;
  const ledGlow = emission(IR_TINT, lit ? 0.22 : 0);
  const pipeMid = (L.pipe[0] + L.pipe[1]) / 2 + L.pipe[2];

  return (
    <group>
      <Explode offset={[0, BODY_H * 2.2 + 2, 0]}>
        <mesh geometry={body} position={[0, BODY_Y, 0]}>
          <Material
            attach="material-0"
            preset="epoxyBlack"
            clip
            roughnessMap={noise}
            roughness={0.62}
            color="#1b1b1d"
            cutColor="#2a2a2c"
          />
          <Material
            attach="material-1"
            preset="epoxyBlack"
            clip
            color="#ffffff"
            map={marking.map}
            roughness={1}
            roughnessMap={marking.roughnessMap}
            bumpMap={marking.bumpMap}
            bumpScale={1.2}
            specularIntensity={0.55}
            cutColor="#2a2a2c"
          />
        </mesh>
        <Anchor name="body" position={[L.length / 2 - 0.8, BODY_Y + BODY_H, -1.6]} />
      </Explode>

      {/* Light pipe: stays in the middle, where the light crosses. */}
      <mesh geometry={pipe}>
        <Material
          clip
          cutColor="#d7e3e8"
          color="#eef6f8"
          roughness={0.18}
          transmission={0.9}
          thickness={1}
          ior={1.41}
          emissive={lit ? IR_TINT : '#000000'}
          emissiveIntensity={lit ? 0.12 : 0}
        />
      </mesh>
      <Anchor name="gap" position={[CUT_X, PIPE_MID, pipeMid * 0.75]} />

      {/* Input side: LED die hanging face down under the raised frame. */}
      <Explode offset={[0, 0, 3]}>
        <mesh geometry={inputFrame}>
          <Material preset="copper" color="#c98a64" roughness={0.35} clip cutColor="#7a4a30" />
        </mesh>
        <mesh position={[0, LED_TOP - LED_T / 2, 0]}>
          <boxGeometry args={[L.led, LED_T, L.led]} />
          <Material
            color="#3a3640"
            metalness={0.35}
            roughness={0.4}
            emissive={ledGlow.emissive}
            emissiveIntensity={ledGlow.emissiveIntensity}
          />
        </mesh>
        <mesh position={[0, LED_FACE - 0.003, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[L.led * 0.2, 20]} />
          <Material preset="gold" />
        </mesh>
        <mesh geometry={ledGlue}>
          <Material color="#c9cbcc" metalness={0.6} roughness={0.5} />
        </mesh>
        {lit && (
          <GlowSprite
            always
            color={IR_TINT}
            intensity={0.75}
            size={1.6}
            position={[0, LED_FACE - 0.12, 0]}
          />
        )}
        <mesh geometry={ledWire}>
          <Material preset="gold" clip />
        </mesh>
        <Anchor name="led" position={[0, LED_FACE, L.led / 2]} />
        <mesh geometry={inputLeads}>
          <Material preset="tin" roughness={0.35} clip cutColor="#8e9296" />
        </mesh>
      </Explode>

      {/* Output side: detector die facing up. */}
      <Explode offset={[0, 0, -3]}>
        <mesh geometry={outputFrame}>
          <Material preset="copper" color="#c98a64" roughness={0.35} clip cutColor="#7a4a30" />
        </mesh>
        <PhotoDie
          size={L.detector.size}
          kind={L.detector.kind}
          pad={L.detector.pad}
          position={[0, DET_BOTTOM, 0]}
        />
        <mesh geometry={detectorWire}>
          <Material preset="gold" clip />
        </mesh>
        <mesh geometry={detectorGlue}>
          <Material color="#c9cbcc" metalness={0.6} roughness={0.5} />
        </mesh>
        <Anchor name="detector" position={[0, DET_TOP, L.detector.size[1] / 2]} />
        <mesh geometry={outputLeads}>
          <Material preset="tin" roughness={0.35} clip cutColor="#8e9296" />
        </mesh>
      </Explode>
    </group>
  );
}

/**
 * Detector die: a large light-sensitive base region (phototransistor) or two
 * anti-parallel thyristor regions (photo-triac), with the aluminium bond pad.
 */
function PhotoDie({
  size,
  kind,
  pad,
  position,
}: {
  size: [number, number];
  kind: 'transistor' | 'triac';
  pad: Pt;
  position: Vec3;
}) {
  const [w, d] = size;
  const px = 256;
  const ph = Math.round((px * d) / w);
  const draw = (ctx: CanvasRenderingContext2D, cw: number, ch: number, metal: boolean) => {
    const rnd = random(kind === 'triac' ? 21 : 13);
    const alu = metal ? '#ffffff' : '#c5c9cf';
    ctx.fillStyle = metal ? '#2a2a2a' : '#262b36';
    ctx.fillRect(0, 0, cw, ch);
    const edge = cw * 0.05;
    ctx.strokeStyle = metal ? '#9a9a9a' : '#8d939d';
    ctx.lineWidth = edge;
    ctx.strokeRect(edge / 2, edge / 2, cw - edge, ch - edge);
    const region = (x: number, y: number, rw: number, rh: number) => {
      if (!metal) {
        // Thin-film colours of the anti-reflection layer over the sensitive area.
        const g = ctx.createLinearGradient(x, y, x + rw, y + rh);
        g.addColorStop(0, '#3b2f5c');
        g.addColorStop(0.5, '#2c4e63');
        g.addColorStop(1, '#4a3a5e');
        ctx.fillStyle = g;
        ctx.fillRect(x, y, rw, rh);
      }
      ctx.strokeStyle = alu;
      ctx.lineWidth = cw * 0.018;
      ctx.strokeRect(x, y, rw, rh);
    };
    const m = edge * 2.2;
    if (kind === 'triac') {
      region(m, m, cw / 2 - m * 1.2, ch - 2 * m);
      region(cw / 2 + m * 0.2, m, cw / 2 - m * 1.2, ch - 2 * m);
    } else {
      region(m, m, cw - 2 * m, ch - 2 * m);
      // Emitter: a small diffused island near the pad.
      ctx.fillStyle = metal ? '#808080' : 'rgba(150,160,180,0.45)';
      const [ex, ez] = [(pad[0] / w + 0.5) * cw, (pad[1] / d + 0.5) * ch];
      ctx.fillRect(ex - cw * 0.17, ez - ch * 0.17, cw * 0.34, ch * 0.34);
    }
    // Speckle of the passivation.
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = metal ? '#3a3a3a' : 'rgba(200,210,230,0.08)';
      ctx.fillRect(rnd() * cw, rnd() * ch, 2, 2);
    }
    // Bond pad (aluminium).
    const [x, z] = pad;
    const r = Math.min(cw, ch) * 0.11;
    ctx.fillStyle = alu;
    ctx.beginPath();
    ctx.arc((x / w + 0.5) * cw, (z / d + 0.5) * ch, r, 0, Math.PI * 2);
    ctx.fill();
  };
  const key = `${kind}|${w}|${d}|${pad.join(',')}`;
  const map = useCanvasTexture((ctx, cw, ch) => draw(ctx, cw, ch, false), key, {
    width: px,
    height: ph,
  });
  const metal = useCanvasTexture((ctx, cw, ch) => draw(ctx, cw, ch, true), key, {
    width: px,
    height: ph,
    color: false,
  });
  return (
    <group position={position}>
      <mesh position={[0, DET_T / 2, 0]}>
        <boxGeometry args={[w, DET_T, d]} />
        <Material color="#4a4d55" metalness={0.5} roughness={0.35} />
      </mesh>
      <mesh position={[0, DET_T + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <Material
          color="#ffffff"
          map={map}
          metalness={1}
          metalnessMap={metal}
          roughness={0.34}
          specularIntensity={0.7}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>
    </group>
  );
}
