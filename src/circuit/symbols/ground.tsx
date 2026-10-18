import { defineSymbol } from './_kit';

/** Ground (reference, 0 V). */
export default defineSymbol({
  type: 'ground',
  pins: { g: [0, 0] },
  box: [-10, 0, 20, 16],
  noLabel: true,
  draw: () => <path d="M0 0V6M-9 6H9M-5.5 10H5.5M-2 14H2" />,
});
