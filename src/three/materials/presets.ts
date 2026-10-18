/**
 * PBR material library (docs/plano/02-arquitetura.md, section 7.2).
 * Values follow measured reflectance where it exists (metals) and catalogue
 * photos for plastics and coatings. Colours are sRGB; three converts them.
 */
import type { MeshPhysicalMaterialParameters } from 'three';

export type MaterialPreset = Omit<
  MeshPhysicalMaterialParameters,
  'clippingPlanes' | 'side' | 'onBeforeCompile'
>;

const metal = (color: string, roughness: number, extra: MaterialPreset = {}): MaterialPreset => ({
  color,
  metalness: 1,
  roughness,
  ...extra,
});

const plastic = (color: string, roughness = 0.5, extra: MaterialPreset = {}): MaterialPreset => ({
  color,
  metalness: 0,
  roughness,
  ...extra,
});

export const PRESETS = {
  // Metals
  copper: metal('#e4a07e', 0.32),
  copperOxidized: metal('#b9785a', 0.55),
  /** Tinned copper leads, solder joints. */
  tin: metal('#d5d8db', 0.28),
  solder: metal('#cfd2d4', 0.18),
  /** Nickel-plated steel: screws, relay frames, battery caps. */
  nickel: metal('#c9c6bf', 0.3),
  steel: metal('#a9abae', 0.4),
  zinc: metal('#bfc4c8', 0.42),
  brass: metal('#dcb56a', 0.3),
  aluminum: metal('#dfe1e4', 0.34),
  brushedAluminum: metal('#d6d9dc', 0.42),
  chrome: metal('#eceef0', 0.06),
  gold: metal('#f1c862', 0.22),
  /** Silicon steel laminations of transformer cores. */
  siliconSteel: metal('#7d8084', 0.48),
  /** Enamelled magnet wire: copper under a red-brown varnish. */
  magnetWire: metal('#b4582c', 0.22, { clearcoat: 1, clearcoatRoughness: 0.08 }),

  // Boards
  /** Green solder mask over copper and FR-4. */
  solderMask: plastic('#14633a', 0.42, { clearcoat: 0.6, clearcoatRoughness: 0.35 }),
  solderMaskBlue: plastic('#123f7a', 0.42, { clearcoat: 0.6, clearcoatRoughness: 0.35 }),
  /** Bare FR-4 (fibreglass and epoxy), seen on board edges and holes. */
  fr4: plastic('#c3b47a', 0.6),
  /** Phenolic paper board (cheap single-sided boards). */
  phenolic: plastic('#b8874a', 0.65),
  silkscreen: plastic('#f3f3ee', 0.75),

  // Plastics
  absBlack: plastic('#1c1c1e', 0.5),
  absDark: plastic('#2e3033', 0.55),
  absGray: plastic('#8b8f94', 0.5),
  absWhite: plastic('#eeece6', 0.45),
  absBeige: plastic('#ddd3bd', 0.5),
  absYellow: plastic('#f0b519', 0.42),
  absRed: plastic('#c4231c', 0.42),
  /** Glass-filled PBT/nylon: terminal blocks, connector housings, relay bases. */
  pbtBlue: plastic('#2b67c6', 0.5),
  pbtGreen: plastic('#2a7a3b', 0.5),
  pbtBlack: plastic('#202124', 0.6),
  nylonNatural: plastic('#efe9d8', 0.55, { transmission: 0, sheen: 0 }),
  rubber: plastic('#1a1a1a', 0.92),
  siliconeRubber: plastic('#3a3a3c', 0.8),
  /** PVC wire insulation (colour set per wire). */
  pvc: plastic('#2a62c9', 0.42, { clearcoat: 0.3, clearcoatRoughness: 0.5 }),

  // Component bodies
  /** Black moulded epoxy of ICs and transistors. */
  epoxyBlack: plastic('#18181a', 0.62),
  /** Dipped epoxy of ceramic disc capacitors. */
  epoxyOrange: plastic('#c9772e', 0.48, { clearcoat: 0.5, clearcoatRoughness: 0.4 }),
  /** Lacquered resistor body (colour set by the part). */
  lacquer: plastic('#d9c398', 0.45, { clearcoat: 0.6, clearcoatRoughness: 0.3 }),
  ceramicWhite: plastic('#f1ede3', 0.55),
  ceramicTan: plastic('#d8c3a0', 0.6),
  ferrite: plastic('#2c2c2e', 0.72),
  carbonFilm: plastic('#26221f', 0.8),
  paper: plastic('#f0ebdd', 0.85),
  /** PET sleeve of electrolytic capacitors (colour set by the part). */
  sleeve: plastic('#1f3a8a', 0.35, { clearcoat: 0.8, clearcoatRoughness: 0.2 }),

  // Transparent
  /** Clear glass: fuses, bulbs, reed switches. */
  glass: {
    color: '#ffffff',
    metalness: 0,
    roughness: 0.03,
    transmission: 1,
    thickness: 0.4,
    ior: 1.5,
    transparent: false,
  },
  /** Clear polycarbonate: relay covers, instrument windows. */
  polycarbonate: {
    color: '#f4f8ff',
    metalness: 0,
    roughness: 0.08,
    transmission: 0.96,
    thickness: 0.8,
    ior: 1.58,
  },
  /** Coloured diffused epoxy of LEDs (colour set by the part). */
  ledEpoxy: {
    color: '#ff3b2f',
    metalness: 0,
    roughness: 0.25,
    transmission: 0.9,
    thickness: 3,
    ior: 1.52,
  },
} satisfies Record<string, MaterialPreset>;

export type PresetName = keyof typeof PRESETS;
