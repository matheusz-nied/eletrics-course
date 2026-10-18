import { formatSI } from '../format';
import { defineSymbol, num } from './_kit';

/** IEC fuse: rectangle crossed by the element; the line breaks when it blows. */
export default defineSymbol({
  type: 'fuse',
  body: 30,
  half: 6,
  live: ['blown'],
  draw: ({ live }) => {
    const blown = live.blown === true;
    return (
      <>
        <rect
          x={-15}
          y={-5}
          width={30}
          height={10}
          rx={1}
          className={blown ? 'sym-burned' : 'sym-body'}
        />
        <path d={blown ? 'M-15 0H-4M4 0H15' : 'M-15 0H15'} />
        {blown && <path d="M-4 0L-2 -3M4 0L2 3" className="sym-danger" strokeWidth={1.4} />}
      </>
    );
  },
  value: (p) => formatSI(num(p.rating, 1), 'A'),
});
