import { z } from 'zod';

/**
 * Structural schema of a CircuitDoc (src/engine/contract.ts). Built on first
 * use so that importing this module costs nothing in production bundles.
 */

let schema: z.ZodType | undefined;

export function circuitSchema(): z.ZodType {
  if (schema) return schema;
  const vec2 = z.tuple([z.number().int(), z.number().int()]);
  const paramValue = z.union([z.number(), z.boolean(), z.string()]);
  const control = z.strictObject({
    param: z.string(),
    label: z.string().min(1),
    kind: z.enum(['toggle', 'momentary', 'slider', 'select']),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().positive().optional(),
    unit: z.string().optional(),
    log: z.boolean().optional(),
    options: z.array(z.strictObject({ value: paramValue, label: z.string() })).optional(),
  });
  const element = z.strictObject({
    id: z.string().regex(/^[A-Za-z0-9_-]+$/, 'use só letras, números, "_" e "-"'),
    type: z.string().min(1),
    a: vec2.optional(),
    b: vec2.optional(),
    at: vec2.optional(),
    rot: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).optional(),
    flip: z.boolean().optional(),
    points: z.array(vec2).optional(),
    params: z.record(z.string(), paramValue).optional(),
    label: z.string().optional(),
    control: z.union([control, z.array(control)]).optional(),
  });
  const probe = z.union([
    z.strictObject({
      id: z.string().min(1),
      kind: z.literal('voltage'),
      plus: z.string(),
      minus: z.string(),
      label: z.string().optional(),
    }),
    z.strictObject({
      id: z.string().min(1),
      kind: z.enum(['current', 'power']),
      element: z.string(),
      label: z.string().optional(),
    }),
  ]);
  const positive = z.number().positive();
  const analysis = z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('dc') }),
    z.strictObject({
      kind: z.literal('transient'),
      dt: positive,
      speed: positive.optional(),
      tStop: positive.optional(),
    }),
    z.strictObject({
      kind: z.literal('ac-sweep'),
      source: z.string(),
      fStart: positive,
      fStop: positive,
      points: z.number().int().min(2),
    }),
    z.strictObject({
      kind: z.literal('quasi-static'),
      frequency: positive,
      dtMech: positive,
      speed: positive.optional(),
    }),
  ]);
  const goal = z.strictObject({
    id: z.string().min(1),
    description: z.string().min(1),
    check: z.strictObject({
      readout: z.string(),
      op: z.enum(['<', '<=', '>', '>=', '==', 'between']),
      value: z.union([paramValue, z.tuple([z.number(), z.number()])]),
    }),
    at: z.number().nonnegative().optional(),
    solution: z.record(z.string(), paramValue).optional(),
  });
  schema = z.strictObject({
    id: z.string().regex(/^[a-z0-9]+(\/[a-z0-9-]+)+$/, 'formato "m02/serie-lampadas"'),
    title: z.string().min(1),
    description: z.string().min(1),
    elements: z.array(element).min(1),
    probes: z.array(probe).optional(),
    analysis,
    view: z
      .strictObject({
        width: positive,
        height: positive,
        showCurrent: z.boolean().optional(),
        showVoltage: z.boolean().optional(),
      })
      .optional(),
    scene3d: z
      .strictObject({ scene: z.string().min(1), bindings: z.record(z.string(), z.string()) })
      .optional(),
    goals: z.array(goal).optional(),
  });
  return schema;
}

/** Structural problems as pt-BR lines: "elements.2.params.resistance: …". */
export function structuralErrors(doc: unknown): string[] {
  const result = circuitSchema().safeParse(doc);
  if (result.success) return [];
  return result.error.issues.map((issue) => {
    const path = issue.path.join('.') || 'circuito';
    return `${path}: ${translate(issue)}`;
  });
}

function translate(issue: z.core.$ZodIssue): string {
  switch (issue.code) {
    case 'invalid_type':
      return issue.input === undefined ? 'campo obrigatório' : `esperado ${issue.expected}`;
    case 'unrecognized_keys':
      return `campo desconhecido: ${issue.keys.join(', ')}`;
    case 'too_small':
      return `valor pequeno demais (mínimo ${String(issue.minimum)})`;
    case 'too_big':
      return `valor grande demais (máximo ${String(issue.maximum)})`;
    case 'invalid_value':
      return `valor inválido (aceitos: ${issue.values.map(String).join(', ')})`;
    case 'invalid_union':
      return 'formato inválido';
    case 'invalid_format':
      return issue.message;
    default:
      return issue.message;
  }
}
