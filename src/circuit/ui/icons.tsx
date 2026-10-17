/** Small inline icons for the simulation toolbar (stroke icons, 20 px grid). */
const paths = {
  play: 'M7 4.5v11l9-5.5z',
  pause: 'M6.5 4.5h2.5v11H6.5zM11 4.5h2.5v11H11z',
  reset: 'M4.5 10a5.5 5.5 0 1 0 1.6-3.9M4.5 3.5v3.2h3.2',
  sound: 'M4 8h3l4-3.5v11L7 12H4zM14 7.5a3.5 3.5 0 0 1 0 5M15.8 5.5a6.5 6.5 0 0 1 0 9',
  mute: 'M4 8h3l4-3.5v11L7 12H4zM14 8l4 4M18 8l-4 4',
  eye: 'M2.5 10s2.8-5 7.5-5 7.5 5 7.5 5-2.8 5-7.5 5-7.5-5-7.5-5zM10 12.3a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6z',
  bolt: 'M11 2.5 5 11h4.5L9 17.5l6-8.5h-4.5z',
  warn: 'M10 3 2.5 16.5h15zM10 8v4M10 14.2v.3',
  info: 'M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zM10 9v5M10 6.2v.3',
  check: 'M4.5 10.5 8 14l7.5-8',
  close: 'M5.5 5.5l9 9M14.5 5.5l-9 9',
  undo: 'M7.5 6.5 4 10l3.5 3.5M4.5 10H12a4 4 0 0 1 0 8h-1',
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const filled = name === 'play' || name === 'pause' || name === 'bolt';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      aria-hidden="true"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}
