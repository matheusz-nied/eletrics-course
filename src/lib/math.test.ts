import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { describe, expect, it } from 'vitest';
import { FORMULA_LABEL, rehypeMathPlugins, remarkMathPlugins } from './math';

async function render(markdown: string) {
  const processor = await createMarkdownProcessor({
    remarkPlugins: remarkMathPlugins,
    rehypePlugins: rehypeMathPlugins,
    syntaxHighlight: false,
  });
  return (await processor.render(markdown)).code;
}

describe('formula pipeline', () => {
  it('renders display formulas as keyboard-focusable, labelled groups', async () => {
    const html = await render('$$\nP = \\frac{V^2}{R}\n$$');
    const [opening] = html.match(/<span class="katex-display"[^>]*>/) ?? [];
    expect(opening).toContain('tabindex="0"');
    expect(opening).toContain('role="group"');
    expect(opening).toContain(`aria-label="${FORMULA_LABEL}"`);
    expect(html).toContain('<math');
  });

  it('leaves inline formulas out of the tab order', async () => {
    const html = await render('A Lei de Ohm, $V = R \\cdot I$, vale para resistores.');
    expect(html).toContain('class="katex"');
    expect(html).not.toContain('katex-display');
    expect(html).not.toContain('tabindex');
  });

  it('keeps invalid TeX visible instead of failing the build', async () => {
    const html = await render('$$\n\\frac{1}{\n$$');
    expect(html).toContain('katex-error');
  });
});

describe('KaTeX stylesheet', () => {
  // The layouts import katex/dist/katex.min.css from the project's own katex;
  // rehype-katex renders with the katex it depends on. KaTeX renames classes
  // between versions (0.16 `base`, 0.19 `katex-base`), so they must match.
  const require = createRequire(import.meta.url);

  it('comes from the same KaTeX version that renders the formulas', () => {
    const fromProject = require('katex/package.json') as { version: string };
    const fromRenderer = createRequire(require.resolve('rehype-katex'))('katex/package.json') as {
      version: string;
    };
    expect(fromProject.version).toBe(fromRenderer.version);
  });

  it('styles the classes the renderer emits', async () => {
    const css = readFileSync(require.resolve('katex/dist/katex.min.css'), 'utf8');
    const styled = new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((match) => match[1]));
    // Atom types KaTeX marks for spacing but does not style.
    const semanticOnly = new Set([
      'mbin',
      'mclose',
      'minner',
      'mop',
      'mopen',
      'mord',
      'mpunct',
      'mrel',
      'mtight',
      'text',
    ]);

    const html = await render(
      [
        'Diodo $V_Z = 5{,}1\\,\\text{V}$, transistor $V_{\\text{CE}}$ e $\\sqrt{2}\\,V_\\text{ef}$.',
        '',
        '$$',
        'P = \\frac{V^2}{R} \\approx \\sum_{k=1}^{n} I_k^2 R_k \\left( \\frac{a}{b} \\right) \\begin{pmatrix} 1 & 0 \\\\ 0 & 1 \\end{pmatrix} \\overline{Q} \\int_0^T v\\,dt',
        '$$',
      ].join('\n'),
    );
    const used = new Set(
      [...html.matchAll(/class="([^"]+)"/g)].flatMap((match) => match[1].split(/\s+/)),
    );
    expect([...used].filter((name) => !styled.has(name) && !semanticOnly.has(name))).toEqual([]);
  });
});
