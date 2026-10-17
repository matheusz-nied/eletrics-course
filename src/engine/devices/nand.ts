import { gateDevice } from '../models/logic';

/** NAND gate (model in models/logic.ts). */
export default gateDevice('nand', (inputs) => !inputs.every(Boolean));
