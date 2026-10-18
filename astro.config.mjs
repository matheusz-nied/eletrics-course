// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import AstroPWA from '@vite-pwa/astro';
import { unified } from '@astrojs/markdown-remark';
import tailwindcss from '@tailwindcss/vite';
import { pwaOptions } from './src/course/pwa/options.mjs';
import { rehypeMathPlugins, remarkMathPlugins } from './src/lib/math.ts';
import { SITE } from './src/lib/site.ts';

const base = '/eletrics-course';

// The remark/rehype pipeline (unified) is used instead of Astro's default
// Sätteri processor because formulas are rendered at build time with
// remark-math + rehype-katex (docs/plano/02-arquitetura.md, section 2;
// plugin list in src/lib/math.ts).
export default defineConfig({
  site: 'https://matheusz-nied.github.io',
  base,
  trailingSlash: 'always',
  integrations: [
    mdx(),
    react(),
    AstroPWA(
      pwaOptions({
        base,
        name: SITE.fullName,
        shortName: 'Eletrônica',
        description: SITE.description,
      }),
    ),
  ],
  markdown: {
    processor: unified({
      remarkPlugins: remarkMathPlugins,
      rehypePlugins: rehypeMathPlugins,
    }),
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
