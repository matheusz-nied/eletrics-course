/**
 * Motor run capacitor (CBB60 style), the one wired between the two windings
 * of single-phase motors in gates, ceiling fans and pumps: metallised
 * polypropylene film wound into a roll, in a cylindrical plastic case sealed
 * with resin, M8 × 10 mm mounting stud, two flying leads (0,75 mm²) or 2 + 2
 * quick-connect tabs (6,3 mm). Case sizes from typical CBB60 catalogues
 * (250/450 VAC, 8–30 µF: Ø 30–50 × 55–90 mm). Generic label, no brand.
 */
import { Color, ExtrudeGeometry, Path } from 'three';
import { formatNumber } from '../core/format';
import { Anchor, Explode } from '../core/view';
import { Material } from '../materials/Material';
import { FONT_SANS, fitText, getNoiseTexture, useCanvasTexture } from '../materials/textures';
import { axialLathe, smoothPath, tube } from '../shapes/geometry';
import { useDisposable } from '../shapes/Wire';
import type { PartMeta, Vec3 } from '../types';
import {
  arc,
  domedDiscGeometry,
  drawWoundSection,
  ExplodeReveal,
  peelPath,
  ribbonGeometry,
  roundedBoxGeometry,
  roundedRectShape,
  SectionFace,
  seeded,
  threadProfile,
  type Path2,
} from './_passive-common';

export interface MotorCapacitorProps {
  /** Capacitance in µF (motor capacitors are always labelled in µF). */
  microfarads?: number;
  /** Rated AC voltage: 250, 400 or 450 VAC. */
  voltage?: number;
  /** Two flying leads or 2 + 2 quick-connect tabs. */
  terminals?: 'fios' | 'terminais';
  color?: 'cinza' | 'preto';
  /** Failed capacitor: swollen top, cracked resin. */
  bulged?: boolean;
}

/** Case diameter × length (mm) by an index that grows with µF and voltage. */
const SIZES = [
  { s: 6, D: 30, L: 55 },
  { s: 10.5, D: 35, L: 60 },
  { s: 16.5, D: 40, L: 65 },
  { s: 25.5, D: 45, L: 70 },
  { s: 40, D: 45, L: 80 },
  { s: 60, D: 50, L: 85 },
  { s: Infinity, D: 50, L: 90 },
];

export function motorCapacitorSize(microfarads: number, voltage: number) {
  const s = microfarads * (voltage / 250) ** 1.5;
  return SIZES.find((x) => s <= x.s) ?? SIZES[SIZES.length - 1]!;
}

const STUD = 10;
const BOSS = 2;
const LIFT = STUD + BOSS;

const microText = (uf: number) => formatNumber(uf, 3);

export const meta: PartMeta = {
  id: 'motor-capacitor',
  label: 'Capacitor de motor',
  category: 'passivos',
  summary:
    'Capacitor permanente de motor monofásico (portão, ventilador, bomba): filme de polipropileno enrolado numa caixa plástica, com etiqueta em µF e VCA.',
  defaults: {
    microfarads: 16,
    voltage: 250,
    terminals: 'fios',
    color: 'cinza',
    bulged: false,
  },
  controls: {
    microfarads: {
      kind: 'select',
      label: 'Capacitância',
      options: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 25, 30, 35, 40].map((v) => ({
        value: v,
        label: `${v} µF`,
      })),
    },
    voltage: {
      kind: 'select',
      label: 'Tensão máxima',
      options: [
        { value: 250, label: '250 VCA' },
        { value: 400, label: '400 VCA' },
        { value: 450, label: '450 VCA' },
      ],
    },
    terminals: {
      kind: 'select',
      label: 'Ligação',
      options: [
        { value: 'fios', label: 'Dois fios' },
        { value: 'terminais', label: 'Terminais tipo faston (2 + 2)' },
      ],
    },
    color: {
      kind: 'select',
      label: 'Cor da caixa',
      options: [
        { value: 'cinza', label: 'Cinza' },
        { value: 'preto', label: 'Preta' },
      ],
    },
    bulged: { kind: 'toggle', label: 'Estufado (com defeito)' },
  },
  annotations: (p) => {
    const { D, L } = motorCapacitorSize(Number(p.microfarads), Number(p.voltage));
    const R = D / 2;
    const top = LIFT + L;
    const notes = [
      {
        at: [-R * 0.25, LIFT + L * 0.62, R * 0.97] as Vec3,
        text: 'Capacitância em µF e tolerância (±5 %)',
        exploded: false,
      },
      {
        at: [R * 0.3, LIFT + L * 0.5, R * 0.95] as Vec3,
        text: 'Tensão máxima em corrente alternada (VCA)',
        exploded: false,
      },
      {
        at: (p.terminals === 'terminais' ? [4, top + 9, 2] : [R * 0.5, top + 15, 0]) as Vec3,
        text: 'Dois terminais, sem polaridade',
        exploded: false,
      },
      { at: [0, STUD * 0.5, 0] as Vec3, text: 'Parafuso de fixação (M8)', exploded: false },
      {
        at: [0, 0, 0] as Vec3,
        text: 'Filme de polipropileno metalizado, enrolado',
        anchor: 'element',
      },
      {
        at: [0, 0, 0] as Vec3,
        text: 'Pontas com zinco: ligam todas as voltas',
        anchor: 'spray',
        exploded: true,
      },
      { at: [0, 0, 0] as Vec3, text: 'Caixa plástica', anchor: 'case', exploded: true },
      { at: [0, 0, 0] as Vec3, text: 'Resina de vedação', anchor: 'potting', exploded: true },
    ];
    if (p.bulged) {
      notes.splice(3, 0, {
        at: [0, top + D * 0.08, 0],
        text: 'Topo estufado e resina rachada: trocar pelo mesmo µF e VCA',
        exploded: false,
      });
    }
    return notes;
  },
  explode: true,
  cutaway: true,
  describe: (p) => {
    const uf = Number(p.microfarads);
    const { D, L } = motorCapacitorSize(uf, Number(p.voltage));
    const leads =
      p.terminals === 'terminais' ? 'quatro terminais faston (dois pares)' : 'dois fios';
    const base = `Capacitor de motor de ${microText(uf)} µF ±5 %, ${p.voltage} VCA, 50/60 Hz, caixa de ${D} × ${L} mm com ${leads}. Não tem polaridade. Pode guardar carga: com o circuito desligado, descarregue-o antes de mexer.`;
    return p.bulged
      ? `${base} Está estufado e precisa ser trocado por outro de mesmo µF e VCA.`
      : base;
  },
  view: [0.55, 0.5, 1.5],
};

export default function MotorCapacitor(props: MotorCapacitorProps) {
  const p = { ...meta.defaults, ...props } as Required<MotorCapacitorProps>;
  const { D, L } = motorCapacitorSize(p.microfarads, p.voltage);
  const R = D / 2;
  const bulged = !!p.bulged;
  const dark = p.color === 'preto';
  const caseColor = dark ? '#1d1e20' : '#8b8d8c';
  const inkColor = dark ? '#ecece6' : '#141414';
  const tWall = 1.3;
  const rim = 1.8; // case wall above the resin
  const resinTop = L - rim;
  const resinBottom = resinTop - 5;
  const dome = bulged ? D * 0.09 : 0;
  const swell = bulged ? D * 0.035 : 0;
  // Outer radius along the height (bulged cases swell near the top).
  const rOut = (y: number) => {
    const t = Math.min(Math.max((y - L * 0.45) / (L * 0.5), 0), 1);
    return R + swell * t * t * (3 - 2 * t);
  };
  const Re = R - tWall - 1.4;
  const elemBottom = 3.2;
  const elemTop = resinBottom - 0.8;
  const spray = 0.9;
  const resinY = (r: number) => resinTop + dome * (1 - (r / (R - tWall)) ** 2);
  const wireR = 1.1;
  const pairZ = 2.7;

  // Outer skin (printed) and inner wall of the case: two surfaces of one solid.
  const caseGeometry = useDisposable(() => {
    const f = 2;
    const steps = 24;
    const path: Path2 = [[0, 0]];
    path.push(...arc(R - f, f, f, -Math.PI / 2, 0, 6));
    for (let i = 1; i <= steps; i++) {
      const y = f + ((L - 0.8 - f) * i) / steps;
      path.push([rOut(y), y]);
    }
    const rt = rOut(L);
    path.push(...arc(rt - 0.8, L - 0.8, 0.8, 0, Math.PI / 2, 4));
    path.push([rt - tWall + 0.25, L]);
    return axialLathe(path, 96);
  }, [R, L, swell]);
  const caseInnerGeometry = useDisposable(() => {
    const rt = rOut(L);
    const steps = 24;
    const path: Path2 = [
      [rt - tWall + 0.25, L],
      [rt - tWall, L - 0.4],
    ];
    for (let i = 1; i <= steps; i++) {
      const y = L - 0.4 - ((L - 0.4 - 2.6) * i) / steps;
      path.push([rOut(y) - tWall, y]);
    }
    path.push([R - tWall - 0.9, 1.7], [0, 1.7]);
    return axialLathe(path, 96);
  }, [R, L, swell]);

  const resinGeometry = useDisposable(() => {
    const rr = R - tWall - 0.02;
    const path: Path2 = [
      [0, resinBottom],
      [rr, resinBottom],
    ];
    // Meniscus where the resin meets the wall.
    path.push([rr, resinTop + 0.35], [rr - 0.5, resinY(rr - 0.5)]);
    for (let i = 1; i <= 16; i++) {
      const r = (rr - 0.5) * (1 - i / 16);
      path.push([r, resinY(r)]);
    }
    return axialLathe(path, 64);
  }, [R, resinBottom, resinTop, dome]);

  const crackGeometry = useDisposable(
    () => domedDiscGeometry(R - tWall - 0.6, 64, 12, (r) => resinY(r) + 0.01),
    [R, resinTop, dome],
  );

  const elementGeometry = useDisposable(() => {
    const f = 0.6;
    const path: Path2 = [
      [0, elemBottom],
      ...arc(Re - f, elemBottom + f, f, -Math.PI / 2, 0, 4),
      ...arc(Re - f, elemTop - f, f, 0, Math.PI / 2, 4),
      [0, elemTop],
    ];
    return axialLathe(path, 72);
  }, [Re, elemBottom, elemTop]);

  const studGeometry = useDisposable(
    () => axialLathe(threadProfile(4, 0.65, 1.25, -LIFT, -BOSS + 0.2), 28),
    [],
  );
  const bossGeometry = useDisposable(() => {
    const path: Path2 = [
      [0, -BOSS],
      [6.2, -BOSS],
      ...arc(6.2, -BOSS + 0.6, 0.6, -Math.PI / 2, 0, 3),
      [7.5, 0.3],
      [0, 0.3],
    ];
    return axialLathe(path, 48);
  }, []);

  // Flying leads: the pair leaves the resin, arches over and lies on the bench.
  const floor = -LIFT + wireR;
  const wirePoints = (side: 1 | -1): Vec3[] => {
    const z = side * pairZ;
    const top = resinY(0);
    return [
      [0, top - 3, z],
      [0, top + 5, z],
      [2.5, top + 13, z],
      [R * 0.7, top + 16, z],
      [R + 6, top + 9, z],
      [R + 10, top - 12, z],
      [R + 11, floor + 10, z],
      [R + 16, floor + 0.4, z * 1.1],
      [R + 28, floor, z * 1.5],
      [R + 40, floor, z * 1.7],
    ];
  };
  const leadGeometryA = useDisposable(() => {
    return tube(smoothPath(wirePoints(1), 0.5), wireR, { radial: 14, segments: 160 });
  }, [R, L, dome]);
  const leadGeometryB = useDisposable(
    () => tube(smoothPath(wirePoints(-1), 0.5), wireR, { radial: 14, segments: 160 }),
    [R, L, dome],
  );
  const strandGeometry = useDisposable(() => {
    const geometry = tube(
      smoothPath([
        [R + 39.5, floor, 0],
        [R + 47, floor, 0],
      ]),
      0.56,
      { radial: 10, segments: 6 },
    );
    return geometry;
  }, [R]);

  // Inner leads: one to the top spray, one down the side to the bottom spray.
  const innerA = useDisposable(
    () =>
      tube(
        smoothPath([
          [0, resinY(0) - 3, pairZ],
          [0, elemTop + 3, pairZ],
          [0.5, elemTop + 0.6, pairZ * 0.6],
        ]),
        wireR * 0.7,
        { radial: 10, segments: 24 },
      ),
    [resinTop, elemTop, dome],
  );
  const innerB = useDisposable(
    () =>
      tube(
        smoothPath([
          [0, resinY(0) - 3, -pairZ],
          [-Re * 0.6, elemTop + 2.2, -pairZ * 0.6],
          [-(Re + 0.7), elemTop - 2, -0.9],
          [-(Re + 0.7), elemBottom + 4, -0.9],
          [-(Re - 1.2), elemBottom - 0.6, -0.9],
        ]),
        wireR * 0.7,
        { radial: 10, segments: 80 },
      ),
    [Re, resinTop, elemTop, dome],
  );

  // Quick-connect tab: 6,35 × 0,8 mm blade with the detent hole.
  const tabGeometry = useDisposable(() => {
    const shape = roundedRectShape(6.35, 8, 0.6);
    const hole = new Path();
    hole.absarc(0, 1.4, 0.9, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const geometry = new ExtrudeGeometry(shape, {
      depth: 0.8,
      bevelEnabled: true,
      bevelSize: 0.08,
      bevelThickness: 0.08,
      bevelSegments: 1,
      curveSegments: 12,
    });
    geometry.translate(0, 4, -0.4);
    // Blade faces ±X, width along Z.
    geometry.rotateY(Math.PI / 2);
    return geometry;
  }, []);
  const blockGeometry = useDisposable(() => roundedBoxGeometry(22, 6, 10, 0.8, 1.6), []);

  // Unrolled film for the exploded view.
  const ribbonLength = D * 0.9;
  const filmGeometry = useDisposable(
    () =>
      ribbonGeometry(
        peelPath(Re + 0.02, 0.3, 0.8, ribbonLength),
        elemBottom + spray,
        elemTop - spray,
      ),
    [Re, elemBottom, elemTop, ribbonLength],
  );
  const film2Geometry = useDisposable(
    () =>
      ribbonGeometry(
        peelPath(Re + 0.12, 0.38, 0.72, ribbonLength * 0.9),
        elemBottom + spray + 0.6,
        elemTop - spray + 0.6,
      ),
    [Re, elemBottom, elemTop, ribbonLength],
  );

  // Printed case: lines around the circumference, centred on the front.
  const circ = Math.PI * D;
  const texW = 2048;
  const texH = Math.round((texW * L) / circ);
  const uf = microText(p.microfarads);
  const labelKey = `${uf}|${p.voltage}|${p.color}|${D}|${L}|${bulged}`;
  const caseMap = useCanvasTexture(
    (ctx, w, h) => {
      const mm = w / circ;
      ctx.fillStyle = caseColor;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = inkColor;
      // Centred a little to the right, facing the default camera.
      const front = w * 0.54;
      const width = Math.min(0.22 * w, 40 * mm);
      const top = h * 0.2;
      const line = (y: number, text: string, size: number, weight = 700) =>
        fitText(ctx, text, front, top + y * mm, width, size * mm, { weight, family: FONT_SANS });
      const k = Math.min(D / 40, 1.15);
      line(0, 'CBB60', 4.2 * k);
      line(9 * k, `${uf} µF ±5%`, 7.2 * k, 800);
      line(17.5 * k, `${p.voltage} VAC  50/60 Hz`, 4.4 * k);
      line(24 * k, '25/70/21   CLASSE B', 3.3 * k, 600);
      line(29.5 * k, 'S0   PP   10000 h', 3.3 * k, 600);
      // Capacitor symbol under the text.
      const sy = top + 36 * k * mm;
      ctx.fillRect(front - 7 * mm, sy - 0.25 * mm, 6 * mm, 0.5 * mm);
      ctx.fillRect(front + 1 * mm, sy - 0.25 * mm, 6 * mm, 0.5 * mm);
      ctx.fillRect(front - 1.2 * mm, sy - 3 * mm, 0.6 * mm, 6 * mm);
      ctx.fillRect(front + 0.6 * mm, sy - 3 * mm, 0.6 * mm, 6 * mm);
      // Back: warning in Portuguese, drawn on both sides of the seam.
      for (const x of [w * 0.04, w * 1.04]) {
        const back = (y: number, text: string, size: number, weight = 700) =>
          fitText(ctx, text, x, top + y * mm, width, size * mm, { weight, family: FONT_SANS });
        back(2 * k, 'CAPACITOR PARA MOTOR', 3.6 * k);
        back(9 * k, `${uf} µF  ${p.voltage} VAC`, 4.6 * k);
        back(17 * k, 'ATENÇÃO: PODE ESTAR CARREGADO.', 2.9 * k, 600);
        back(22 * k, 'DESCARREGUE ANTES DE MANUSEAR.', 2.9 * k, 600);
      }
      // Date code near the bottom.
      fitText(ctx, '2025-08', front, h - 9 * mm, width, 2.6 * mm, { weight: 600 });
    },
    labelKey,
    { width: texW, height: texH, fonts: [`700 40px ${FONT_SANS}`, `800 40px ${FONT_SANS}`] },
  );

  const resinMap = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = 'rgba(0,0,0,0)';
      ctx.clearRect(0, 0, w, h);
      if (!bulged) return;
      const random = seeded(5);
      ctx.strokeStyle = '#050505';
      ctx.lineCap = 'round';
      for (let k = 0; k < 7; k++) {
        let x = w / 2 + (random() - 0.5) * w * 0.12;
        let y = h / 2 + (random() - 0.5) * h * 0.12;
        let a = (k / 7) * Math.PI * 2 + random() * 0.6;
        ctx.lineWidth = 2 + random() * 3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let i = 0; i < 14; i++) {
          a += (random() - 0.5) * 0.7;
          x += Math.cos(a) * w * 0.028;
          y += Math.sin(a) * h * 0.028;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    },
    `${bulged}`,
    { width: 512, height: 512 },
  );

  const sectionMap = useCanvasTexture(
    (ctx, w, h) =>
      drawWoundSection(ctx, w, h, {
        layers: 34,
        colors: ['#e9ecef', '#9da4ab', '#d6dadf', '#b3b9c0'],
        weights: [1.2, 0.5, 1.2, 0.5],
        core: 0.045,
        coreColor: '#b9b6ad',
        margin: spray / (elemTop - elemBottom),
        marginColor: '#8d9095',
      }),
    'pp',
    { width: 1024, height: 512 },
  );

  // Metallised film: mirror-like aluminium with the clear margin on one edge.
  const filmMap = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#c7ccd2';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#eef1f4';
      ctx.fillRect(0, 0, w, h * 0.06);
    },
    'film',
    { width: 64, height: 256 },
  );

  const strandMap = useCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#cfd3d6';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#7d8185';
      ctx.lineWidth = 3;
      for (let i = -8; i < 16; i++) {
        ctx.beginPath();
        ctx.moveTo((i * w) / 8, 0);
        ctx.lineTo((i * w) / 8 + w * 0.6, h);
        ctx.stroke();
      }
    },
    'strands',
    { width: 128, height: 64 },
  );

  const noise = getNoiseTexture();
  const caseCut = `#${new Color(caseColor).multiplyScalar(0.75).getHexString()}`;
  const wireColor = dark ? '#8d9196' : '#1c1c1e';
  const blockY = resinY(0) + 3;

  return (
    <group position={[0, LIFT, 0]}>
      {/* Case with the printed label, the mounting boss and the stud. */}
      <Explode offset={[-(D + 14), 0, 0]}>
        <mesh geometry={caseGeometry} rotation={[0, Math.PI, 0]}>
          <Material
            preset="absGray"
            clip
            color="#ffffff"
            map={caseMap}
            roughnessMap={noise}
            roughness={0.62}
            clearcoat={0}
            cutColor={caseCut}
          />
        </mesh>
        <mesh geometry={caseInnerGeometry}>
          <Material preset="absGray" clip color={caseColor} roughness={0.6} cutColor={caseCut} />
        </mesh>
        <mesh geometry={bossGeometry}>
          <Material preset="absGray" clip color={caseColor} roughness={0.5} cutColor={caseCut} />
        </mesh>
        <mesh geometry={studGeometry}>
          <Material preset="zinc" roughness={0.38} />
        </mesh>
        <Anchor name="case" position={[-R, L * 0.6, 0]} />
      </Explode>

      {/* Sealing resin on top (and the terminal block when fitted). */}
      <Explode offset={[0, 12, 0]}>
        <mesh geometry={resinGeometry}>
          <Material preset="epoxyBlack" clip color="#26272a" roughness={0.35} cutColor="#1a1a1c" />
        </mesh>
        {bulged && (
          <mesh geometry={crackGeometry}>
            <Material
              preset="epoxyBlack"
              color="#ffffff"
              map={resinMap}
              transparent
              depthWrite={false}
              polygonOffset
              polygonOffsetFactor={-2}
            />
          </mesh>
        )}
        <Anchor name="potting" position={[R * 0.55, resinTop, 0]} />
        {p.terminals === 'terminais' && (
          <group position={[0, blockY, 0]}>
            <mesh geometry={blockGeometry}>
              <Material
                preset="absGray"
                clip
                color={caseColor}
                roughness={0.45}
                cutColor={caseCut}
              />
            </mesh>
            {/* Separating wall between the two terminals. */}
            <mesh position={[0, 4.5, 0]}>
              <boxGeometry args={[1.2, 3.5, 9]} />
              <Material preset="absGray" color={caseColor} roughness={0.45} />
            </mesh>
            {[-6.9, -2.6, 2.6, 6.9].map((x) => (
              <mesh key={x} geometry={tabGeometry} position={[x, 2.4, 0]}>
                <Material preset="tin" roughness={0.3} />
              </mesh>
            ))}
          </group>
        )}
      </Explode>

      {/* Wound element: metallised polypropylene with zinc-sprayed ends. */}
      <mesh geometry={elementGeometry}>
        <Material
          preset="aluminum"
          clip
          color="#d9dde2"
          roughness={0.25}
          clearcoat={0.8}
          clearcoatRoughness={0.15}
          cutColor="#9aa0a6"
        />
      </mesh>
      {([elemBottom, elemTop - spray] as const).map((y) => (
        <mesh key={y} position={[0, y + spray / 2, 0]}>
          <cylinderGeometry args={[Re + 0.05, Re + 0.05, spray + 0.05, 72, 1]} />
          <Material preset="zinc" clip color="#9a9da1" roughnessMap={noise} roughness={0.85} />
        </mesh>
      ))}
      <SectionFace
        width={Re * 2}
        height={elemTop - elemBottom - 0.2}
        center={[0, (elemTop + elemBottom) / 2]}
        map={sectionMap}
      />
      <Anchor name="element" position={[Re * 0.7, (elemTop + elemBottom) / 2, Re * 0.4]} />
      <Anchor name="spray" position={[Re * 0.5, elemTop, Re * 0.3]} />
      <ExplodeReveal from={0.4} axis="all">
        <mesh geometry={filmGeometry}>
          <Material preset="aluminum" color="#ffffff" map={filmMap} roughness={0.18} side={2} />
        </mesh>
        <mesh geometry={film2Geometry}>
          <Material preset="aluminum" color="#ffffff" map={filmMap} roughness={0.22} side={2} />
        </mesh>
      </ExplodeReveal>

      {/* Internal leads soldered to the sprayed ends. */}
      <mesh geometry={innerA}>
        <Material preset="pvc" color={wireColor} />
      </mesh>
      <mesh geometry={innerB}>
        <Material preset="pvc" color={wireColor} />
      </mesh>
      {[
        [0.5, elemTop + 0.4, pairZ * 0.6],
        [-(Re - 1.2), elemBottom - 0.2, -0.9],
      ].map((at, i) => (
        <mesh key={i} position={at as Vec3} scale={[1, 0.55, 1]}>
          <sphereGeometry args={[1.3, 16, 12]} />
          <Material preset="solder" roughness={0.3} />
        </mesh>
      ))}

      {/* Flying leads with stripped, tinned ends. */}
      {p.terminals === 'fios' && (
        <group>
          <mesh geometry={leadGeometryA}>
            <Material preset="pvc" color={wireColor} roughness={0.45} />
          </mesh>
          <mesh geometry={leadGeometryB}>
            <Material preset="pvc" color={wireColor} roughness={0.45} />
          </mesh>
          {([1, -1] as const).map((side) => (
            <mesh key={side} geometry={strandGeometry} position={[0, 0, side * pairZ * 1.7]}>
              <Material preset="tin" color="#ffffff" map={strandMap} roughness={0.35} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}
