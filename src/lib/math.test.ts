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
