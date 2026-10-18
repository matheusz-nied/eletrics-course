/*
 * Lesson 1.1 (atoms, electrons and charge): the free electrons of a piece of
 * copper wire. Without a battery they only jiggle, bouncing off the ions, and
 * go nowhere on average. With the battery on, a slow drift to the right adds
 * up over the jiggle. A counter at the dashed line shows how many electrons
 * cross that section of the wire in each direction: the net flow is the
 * current. The animation runs outside React (refs + requestAnimationFrame);
 * React only renders the initial frame and the controls.
 */
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import '../m00/widget.css';
import './eletrons-livres.css';

const W = 640;
const H = 170;
const LEFT = 20;
const RIGHT = 620;
const TOP = 25;
const BOTTOM = 145;
const SPAN = RIGHT - LEFT;
const SECTION = (LEFT + RIGHT) / 2;
const COLS = 15;
const ROWS = 3;
/** One free electron per copper atom. */
const COUNT = COLS * ROWS;
const RADIUS = 6;
/** Random speed of the jiggle (px/s) and mean time between collisions (s). */
const SPEED = 125;
const FREE_TIME = 0.3;
/** Drift with the battery on (px/s): hugely exaggerated, see the note. */
const DRIFT = 45;
const TRAIL = 120;

interface Electron {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Time left until the next collision (s). */
  next: number;
}

const IONS = Array.from({ length: COUNT }, (_, i) => ({
  x: LEFT + ((i % COLS) + 0.5) * (SPAN / COLS),
  y: TOP + (Math.floor(i / COLS) + 0.5) * ((BOTTOM - TOP) / ROWS),
}));

/** Deterministic random numbers, so the server and the browser draw the same first frame. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function kick(e: Electron, rand: () => number) {
  const angle = rand() * 2 * Math.PI;
  const speed = SPEED * (0.6 + 0.8 * rand());
  e.vx = speed * Math.cos(angle);
  e.vy = speed * Math.sin(angle);
  e.next = -FREE_TIME * Math.log(1 - rand());
}

function initialElectrons(): Electron[] {
  const rand = seeded(29);
  return IONS.map((ion) => {
    const e: Electron = {
      x: ion.x + (rand() - 0.5) * 30,
      y: Math.min(BOTTOM - RADIUS, Math.max(TOP + RADIUS, ion.y + (rand() - 0.5) * 30)),
      vx: 0,
      vy: 0,
      next: 0,
    };
    kick(e, rand);
    return e;
  });
}

const FIRST = initialElectrons();

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

export default function EletronsLivres() {
  const id = useId();
  const [on, setOn] = useState(false);
  const [highlight, setHighlight] = useState(false);
  // null until the reader presses play or pause: then motion follows the system setting.
  const [chosen, setChosen] = useState<boolean | null>(null);
  const [counts, setCounts] = useState({ right: 0, left: 0, seconds: 0 });
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => true,
  );
  const running = chosen ?? !reducedMotion;

  const electrons = useRef<Electron[]>(FIRST.map((e) => ({ ...e })));
  const dots = useRef<(SVGCircleElement | null)[]>([]);
  const trail = useRef<SVGPolylineElement | null>(null);
  const svg = useRef<SVGSVGElement | null>(null);
  const tally = useRef({ right: 0, left: 0, seconds: 0 });
  const visible = useRef(true);
  const drift = useRef(0);
  const path = useRef<string[]>([]);

  // Pause the work while the figure is off screen.
  useEffect(() => {
    const el = svg.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      visible.current = entry?.isIntersecting ?? true;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // A new experiment every time the battery is switched.
  const toggleBattery = () => {
    const next = !on;
    drift.current = next ? DRIFT : 0;
    tally.current = { right: 0, left: 0, seconds: 0 };
    setCounts({ ...tally.current });
    setOn(next);
  };

  const toggleHighlight = (value: boolean) => {
    path.current = [];
    trail.current?.setAttribute('points', '');
    setHighlight(value);
  };

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last: number | null = null;
    const rand = Math.random;

    const step = (dt: number) => {
      tally.current.seconds += dt;
      electrons.current.forEach((e, i) => {
        e.next -= dt;
        if (e.next <= 0) kick(e, rand);
        const before = e.x;
        e.x += (e.vx + drift.current) * dt;
        e.y += e.vy * dt;
        if (e.y < TOP + RADIUS) {
          e.y = 2 * (TOP + RADIUS) - e.y;
          e.vy = -e.vy;
        } else if (e.y > BOTTOM - RADIUS) {
          e.y = 2 * (BOTTOM - RADIUS) - e.y;
          e.vy = -e.vy;
        }
        let wrapped = false;
        if (e.x > RIGHT) {
          e.x -= SPAN;
          wrapped = true;
        } else if (e.x < LEFT) {
          e.x += SPAN;
          wrapped = true;
        }
        if (!wrapped) {
          if (before < SECTION && e.x >= SECTION) tally.current.right += 1;
          else if (before >= SECTION && e.x < SECTION) tally.current.left += 1;
        }
        const dot = dots.current[i];
        dot?.setAttribute('cx', e.x.toFixed(1));
        dot?.setAttribute('cy', e.y.toFixed(1));
        if (i === 0 && trail.current) {
          if (wrapped) path.current = [];
          if (trail.current.dataset.on === 'true') {
            path.current.push(`${e.x.toFixed(1)},${e.y.toFixed(1)}`);
            if (path.current.length > TRAIL) path.current.shift();
            trail.current.setAttribute('points', path.current.join(' '));
          }
        }
      });
    };

    const frame = (now: number) => {
      const dt = last === null ? 0 : Math.min((now - last) / 1000, 0.05);
      last = now;
      if (visible.current) step(dt);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const timer = window.setInterval(() => setCounts({ ...tally.current }), 250);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(timer);
    };
  }, [running]);

  const net = counts.right - counts.left;
  const seconds = Math.floor(counts.seconds);
  const description = on
    ? 'Pilha ligada. Além da agitação desordenada, todos os elétrons livres derivam devagar para a direita, em direção ao polo positivo. O saldo de elétrons que cruzam a linha tracejada cresce sem parar.'
    : 'Pilha desligada. Os elétrons livres se agitam em todas as direções e batem nos íons de cobre, mas na média não vão a lugar nenhum: o saldo de elétrons que cruzam a linha tracejada fica perto de zero.';

  return (
    <section className="lw elivres" aria-labelledby={`${id}-titulo`}>
      <header className="lw__head">
        <p className="lw__kicker">Explore</p>
        <h3 id={`${id}-titulo`} className="lw__title">
          Os elétrons livres dentro de um fio de cobre
        </h3>
        <p className="lw__lead">
          Um pedaço de fio visto de muito perto. Ligue e desligue a pilha e acompanhe o contador na
          linha tracejada.
        </p>
      </header>

      <div className="lw__body">
        <div className="elivres__stage">
          <div className={on ? 'elivres__ends elivres__ends--on' : 'elivres__ends'}>
            <span>{on ? '← vem do polo − da pilha' : 'pilha desligada'}</span>
            {on && <span>vai para o polo + da pilha →</span>}
          </div>
          <svg
            ref={svg}
            className="elivres__svg"
            viewBox={`0 0 ${W} ${H}`}
            width={W}
            height={H}
            preserveAspectRatio="xMidYMid slice"
            role="img"
            aria-labelledby={`${id}-svg-titulo ${id}-svg-desc`}
          >
            <title id={`${id}-svg-titulo`}>Elétrons livres num fio de cobre</title>
            <desc id={`${id}-svg-desc`}>{description}</desc>
            <rect
              x={LEFT - 12}
              y={TOP - 12}
              width={SPAN + 24}
              height={BOTTOM - TOP + 24}
              rx="18"
              className="elivres__wire"
            />
            {IONS.map((ion, i) => (
              <g key={i} className="elivres__ion">
                <circle cx={ion.x} cy={ion.y} r="10" />
                <path d={`M${ion.x - 4} ${ion.y}h8M${ion.x} ${ion.y - 4}v8`} />
              </g>
            ))}
            <path d={`M${SECTION} ${TOP - 18}V${BOTTOM + 18}`} className="elivres__section" />
            <polyline
              ref={trail}
              className="elivres__trail"
              data-on={highlight ? 'true' : 'false'}
              points=""
            />
            {FIRST.map((e, i) => (
              <circle
                key={i}
                ref={(el) => {
                  dots.current[i] = el;
                }}
                cx={e.x.toFixed(1)}
                cy={e.y.toFixed(1)}
                r={i === 0 && highlight ? RADIUS + 2 : RADIUS}
                className={
                  i === 0 && highlight
                    ? 'elivres__electron elivres__electron--marked'
                    : 'elivres__electron'
                }
              />
            ))}
          </svg>
          <ul className="elivres__legend" aria-hidden="true">
            <li>
              <span className="elivres__key elivres__key--ion" /> íon de cobre (+)
            </li>
            <li>
              <span className="elivres__key elivres__key--electron" /> elétron livre (−)
            </li>
            <li>
              <span className="elivres__key elivres__key--section" /> seção do fio
            </li>
          </ul>
        </div>

        <div className="elivres__controls">
          <button
            type="button"
            className={on ? 'lw__btn lw__btn--primary' : 'lw__btn'}
            aria-pressed={on}
            onClick={toggleBattery}
          >
            <span className="elivres__switch" aria-hidden="true" />
            Ligar a pilha
          </button>
          <label className="lw__check">
            <input
              type="checkbox"
              checked={highlight}
              onChange={(e) => toggleHighlight(e.target.checked)}
            />
            Destacar um elétron
          </label>
          <button type="button" className="lw__btn" onClick={() => setChosen(!running)}>
            {running ? 'Pausar a animação' : 'Animar'}
          </button>
        </div>

        <div className="lw__output">
          <div className={on ? 'lw__status lw__status--ok' : 'lw__status'} aria-live="polite">
            <span className="lw__status-dot" aria-hidden="true" />
            <p>{description}</p>
          </div>
          <dl className="elivres__counts">
            <div>
              <dt>Para a direita</dt>
              <dd>{counts.right}</dd>
            </div>
            <div>
              <dt>Para a esquerda</dt>
              <dd>{counts.left}</dd>
            </div>
            <div>
              <dt>Saldo para a direita</dt>
              <dd>{net < 0 ? `−${-net}` : net}</dd>
            </div>
            <div>
              <dt>Tempo</dt>
              <dd>{seconds} s</dd>
            </div>
          </dl>
          <p className="lw__note">
            Elétrons que cruzaram a linha tracejada desde a última vez que a pilha foi ligada ou
            desligada. Na animação, a deriva está muito exagerada: num fio de verdade, a agitação é
            bilhões de vezes mais rápida que a deriva.
          </p>
        </div>
      </div>
    </section>
  );
}
