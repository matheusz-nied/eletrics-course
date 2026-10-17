import { gateDevice } from '../models/logic';

/** AND gate (model in models/logic.ts). */
export default gateDevice('and', (inputs) => inputs.every(Boolean));
