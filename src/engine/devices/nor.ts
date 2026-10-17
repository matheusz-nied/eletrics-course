import { gateDevice } from '../models/logic';

/** NOR gate (model in models/logic.ts). */
export default gateDevice('nor', (inputs) => !inputs.some(Boolean));
