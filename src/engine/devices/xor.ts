import { gateDevice } from '../models/logic';

/** XOR gate (model in models/logic.ts). */
export default gateDevice('xor', (inputs) => inputs[0] !== inputs[1]);
