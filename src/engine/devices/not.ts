import { gateDevice } from '../models/logic';

/** NOT gate (model in models/logic.ts). */
export default gateDevice('not', (inputs) => !inputs[0]);
