import type { RehypePlugins, RemarkPlugins } from '@astrojs/markdown-remark';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';

/**
 * Formula pipeline for Markdown and MDX: `$…$` and `$$…$$` are rendered by
 * KaTeX at build time, then display formulas are made keyboard-reachable.
 */
export const remarkMathPlugins: RemarkPlugins = [remarkMath];

export const rehypeMathPlugins: RehypePlugins = [
  [rehypeKatex, { strict: 'ignore' }],
  rehypeFocusableFormulas,
];

/** Accessible name of a display formula; screen readers then read its MathML. */
export const FORMULA_LABEL = 'Fórmula';

interface HastNode {
  type: string;
  children?: HastNode[];
}

interface HastElement extends HastNode {
  type: 'element';
  properties: Record<string, unknown>;
}

/**
 * A display formula wider than the column scrolls sideways
 * (`.katex-display { overflow-x: auto }`), and a scrolling region has to take
 * keyboard focus so it can be scrolled with the arrow keys (WCAG 2.1.1, axe
 * `scrollable-region-focusable`). Runs after rehype-katex.
 */
export function rehypeFocusableFormulas() {
  return (tree: HastNode) => visit(tree);
}

function visit(node: HastNode) {
  if (isElement(node) && classList(node).includes('katex-display')) {
    node.properties.tabIndex = 0;
    node.properties.role = 'group';
    node.properties.ariaLabel = FORMULA_LABEL;
    return;
  }
  node.children?.forEach(visit);
}

function isElement(node: HastNode): node is HastElement {
  return node.type === 'element';
}

function classList(element: HastElement): unknown[] {
  const value = element.properties.className;
  return Array.isArray(value) ? value : [];
}
