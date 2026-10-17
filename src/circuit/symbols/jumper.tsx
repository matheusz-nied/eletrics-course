import { defineSymbol } from './_kit';

/** Jumper: two header pins and the removable bridge. */
export default defineSymbol({
  type: 'jumper',
  body: 24,
  half: 10,
  draw: ({ params }) => {
    const fitted = params.fitted !== false;
    return (
      <>
        <path d="M-12 0H-6M6 0H12" />
        <rect x={-8} y={-2.5} width={5} height={5} className="sym-fill" />
        <rect x={3} y={-2.5} width={5} height={5} className="sym-fill" />
        <rect
          x={-11}
          y={fitted ? -5 : -14}
          width={22}
          height={10}
          rx={2}
          className="sym-jumper"
          transform={fitted ? undefined : 'rotate(-12 0 -9)'}
        />
      </>
    );
  },
  value: (p) => (p.fitted === false ? 'aberto' : 'colocado'),
});
