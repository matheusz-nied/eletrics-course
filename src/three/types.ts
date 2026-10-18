/**
 * Public types of the 3D kit (docs/plano/02-arquitetura.md, section 7.3).
 * Parts are React Three Fiber components in millimetres (1 unit = 1 mm),
 * Y up, resting on the plane y = 0 and roughly centred on the origin.
 */
import type { ComponentType } from 'react';

export type Vec3 = [number, number, number];

/** A part parameter value. Props must be serializable: they come from MDX. */
export type PartValue = number | boolean | string;
export type PartProps = Record<string, PartValue | undefined>;

export type PartCategory =
  | 'passivos'
  | 'semicondutores'
  | 'eletromecanicos'
  | 'conexoes'
  | 'energia'
  | 'sensores'
  | 'saidas'
  | 'magnetismo'
  | 'placas'
  | 'instrumentos';

export const CATEGORY_LABELS: Record<PartCategory, string> = {
  passivos: 'Passivos',
  semicondutores: 'Semicondutores',
  eletromecanicos: 'Chaves e eletromecânicos',
  conexoes: 'Conexões e fios',
  energia: 'Pilhas, baterias e transformadores',
  sensores: 'Sensores',
  saidas: 'Lâmpadas, motores e sinalização',
  magnetismo: 'Ímãs e bobinas',
  placas: 'Placas e montagem',
  instrumentos: 'Instrumentos',
};

/** How the gallery (and future editors) present a parameter. Labels in pt-BR. */
export type PartControl =
  | {
      kind: 'number';
      label: string;
      min: number;
      max: number;
      step?: number;
      /** Logarithmic slider (resistance, capacitance). */
      log?: boolean;
      unit?: string;
    }
  | { kind: 'select'; label: string; options: { value: string | number; label: string }[] }
  | { kind: 'toggle'; label: string }
  | { kind: 'text'; label: string; maxLength?: number };

export interface PartAnnotation {
  /** Position in the part's space (mm). */
  at: Vec3;
  /** Short text in pt-BR. */
  text: string;
  /**
   * Name of an `<Anchor>` rendered by the part. When present, the marker follows
   * the anchor (useful for pieces that move in the exploded view).
   */
  anchor?: string;
  /** Only shown in the exploded view (or only outside it, with `false`). */
  exploded?: boolean;
}

export interface PartMeta {
  /** Same as the file name: `resistor`. */
  id: string;
  /** Name shown to the student (pt-BR). */
  label: string;
  category: PartCategory;
  /** One sentence for the gallery and for screen readers (pt-BR). */
  summary: string;
  /** Default props; also the props used for the poster. */
  defaults: PartProps;
  /** Gallery controls, by prop name. Props without a control keep the default. */
  controls?: Record<string, PartControl>;
  /** Markers with explanations; a function when they depend on the props. */
  annotations?: PartAnnotation[] | ((props: PartProps) => PartAnnotation[]);
  /** The part has an exploded view (it uses `<Explode>`). */
  explode?: boolean;
  /** The part has a cutaway view (it uses clipped materials). */
  cutaway?: boolean;
  /**
   * Where the cutaway cuts (default: the plane z = 0, removing the half that
   * faces the camera). A function when it depends on the props.
   */
  cut?: PartCut | ((props: PartProps) => PartCut);
  /** Accessible description of the part with these props (pt-BR). */
  describe?: (props: PartProps) => string;
  /** Preferred camera direction (from the target towards the camera). */
  view?: Vec3;
  /** Keeps rendering every frame (motors, blinking, smoke). */
  animated?: boolean | ((props: PartProps) => boolean);
}

export interface PartCut {
  /** Normal of the cut plane: the half it points away from is removed. */
  normal?: Vec3;
  /** A point the plane goes through (mm). */
  through?: Vec3;
}

export interface PartModule {
  meta: PartMeta;
  default: ComponentType<PartProps>;
}
