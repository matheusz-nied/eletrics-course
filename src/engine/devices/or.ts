import { gateDevice } from '../models/logic';

/** OR gate (model in models/logic.ts). */
export default gateDevice('or', (inputs) => inputs.some(Boolean));
