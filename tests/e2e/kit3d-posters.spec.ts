/**
 * Poster generator for the 3D kit: renders every part with its default props
 * and saves src/three/posters/<id>.webp (960 × 600). Runs only on request:
 *
 *   pnpm build && UPDATE_POSTERS=1 pnpm exec playwright test kit3d-posters --project=desktop
 *
 * then `pnpm build` again so the new posters are bundled.
 */
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const PARTS = ['parts', 'instruments'].flatMap((dir) =>
  readdirSync(`src/three/${dir}`)
    .filter((f) => f.endsWith('.tsx') && !f.startsWith('_') && !f.endsWith('.test.tsx'))
    .map((f) => f.replace(/\.tsx$/, '')),
);

test.describe('posters', () => {
  test.skip(!process.env.UPDATE_POSTERS, 'set UPDATE_POSTERS=1 to regenerate the posters');
  test.use({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: 1 });

  for (const id of PARTS) {
    test(id, async ({ page }) => {
      test.setTimeout(120_000);
      await page.goto(`dev/pecas/?peca=${id}&poster&qualidade=alta`);
      const view = page.locator('.m3d');
      await expect(view).toHaveAttribute('data-status', 'ready', { timeout: 90_000 });
      // Let the post-processing (ambient occlusion, bloom) settle.
      await page.waitForTimeout(1500);
      const data = await page
        .locator('.m3d canvas')
        .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL('image/webp', 0.86));
      expect(data.startsWith('data:image/webp')).toBe(true);
      mkdirSync('src/three/posters', { recursive: true });
      writeFileSync(`src/three/posters/${id}.webp`, Buffer.from(data.split(',')[1]!, 'base64'));
    });
  }
});
