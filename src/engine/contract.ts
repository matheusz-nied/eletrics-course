/*
 * Public contract of the simulation engine (docs/plano/02-arquitetura.md, section 5.2).
 * Created by the Fundação exactly as in the plan; owned by the Simulação front.
 * Only backward-compatible changes (new optional fields); breaking changes go
 * through the coordinator.
 */

/** Coordenadas na grade do esquemático (inteiros). 1 unidade = 10 px no zoom 1. */
export type Vec2 = [number, number];
export type ParamValue = number | boolean | string;

export interface ControlDoc {
  param: string; // parâmetro do elemento controlado
  label: string; // pt-BR
  kind: 'toggle' | 'momentary' | 'slider' | 'select';
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  log?: boolean;
  options?: { value: ParamValue; label: string }[];
}

export interface ElementDoc {
  id: string; // único no circuito: "R1", "K1", "M1"
  type: string; // tipo do catálogo: "resistor", "relay-spdt"…
  a?: Vec2;
  b?: Vec2; // dispositivos de 2 terminais (comprimento livre, alinhado aos eixos)
  at?: Vec2;
  rot?: 0 | 90 | 180 | 270;
  flip?: boolean; // dispositivos com N terminais
  points?: Vec2[]; // só para type "wire" (polilinha)
  params?: Record<string, ParamValue>;
  label?: string; // rótulo visível (pt-BR)
  control?: ControlDoc | ControlDoc[]; // torna parâmetros interativos
}

export type ProbeDoc =
  | { id: string; kind: 'voltage'; plus: string; minus: string; label?: string } // "R1.a", "GND"
  | { id: string; kind: 'current' | 'power'; element: string; label?: string };

export type AnalysisDoc =
  | { kind: 'dc' }
  | { kind: 'transient'; dt: number; speed?: number; tStop?: number }
  | { kind: 'ac-sweep'; source: string; fStart: number; fStop: number; points: number }
  | { kind: 'quasi-static'; frequency: number; dtMech: number; speed?: number };

export interface GoalDoc {
  // metas de desafios ("acenda o LED com 10 mA")
  id: string;
  description: string; // pt-BR
  check: {
    readout: string;
    op: '<' | '<=' | '>' | '>=' | '==' | 'between';
    value: ParamValue | [number, number];
  };
}

export interface CircuitDoc {
  id: string; // "m02/serie-lampadas" (igual ao caminho em src/lessons)
  title: string; // pt-BR
  description: string; // descrição acessível em pt-BR
  elements: ElementDoc[];
  probes?: ProbeDoc[];
  analysis: AnalysisDoc;
  view?: { width: number; height: number; showCurrent?: boolean; showVoltage?: boolean };
  scene3d?: { scene: string; bindings: Record<string, string> }; // prop da cena ← leitura ("lamp.brightness" ← "L1.brightness")
  goals?: GoalDoc[];
}

export interface SimEvent {
  t: number;
  element: string;
  kind: 'damaged' | 'tripped' | 'warning' | 'info';
  message: string; // pt-BR, pronto para mostrar
}

export interface SimFrame {
  t: number; // tempo simulado (s)
  nodeVoltages: Record<string, number>;
  readouts: Record<string, number | boolean | string>; // "R1.current", "L1.brightness", "K1.closed", "M1.rpm", "F1.blown"
  events: SimEvent[]; // eventos novos desde o último quadro
}

export interface PinInfo {
  name: string;
  offset: Vec2;
} // relativo a `at`, rotação 0
export interface ParamInfo {
  default: ParamValue;
  label: string;
  unit?: string;
  min?: number;
  max?: number;
}
export interface DeviceInfo {
  type: string;
  label: string; // label em pt-BR
  terminals: 'two' | 'fixed';
  pins: PinInfo[]; // para 'two': [{name:'a'},{name:'b'}] (offset ignorado)
  params: Record<string, ParamInfo>;
  readouts: string[];
}

export interface Netlist {
  nodes: { id: string; points: Vec2[] }[]; // pontos da grade que pertencem a cada nó (para colorir fios)
  pins: Record<string, string>; // "R1.a" → id do nó
}

export interface SimHandle {
  load(doc: CircuitDoc): Promise<void>;
  setParam(element: string, param: string, value: ParamValue): void;
  play(): void;
  pause(): void;
  reset(): void;
  setSpeed(factor: number): void;
  subscribe(listener: (frame: SimFrame) => void): () => void;
  runUntil(t: number): Promise<SimFrame[]>; // gráficos estáticos e testes
  dispose(): void;
}

// Exportados por src/engine/index.ts:
// createSimulation(opts?: { worker?: boolean }): SimHandle
// buildNetlist(doc: CircuitDoc): Netlist
// getDeviceInfo(type: string): DeviceInfo
// listDevices(): DeviceInfo[]
// defineCircuit(doc: CircuitDoc): CircuitDoc   (identidade tipada + validação zod em dev)
