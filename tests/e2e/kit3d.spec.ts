import { readdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import {
  EXAMPLE_LESSON,
  expectAccessible,
  expectNoHorizontalOverflow,
  watchErrors,
} from './helpers';

const GALLERY = 'dev/pecas/';

/** Every part of the kit: one file per part in src/three/parts and src/three/instruments. */
const PARTS = ['parts', 'instruments'].flatMap((dir) =>
  readdirSync(`src/three/${dir}`)
    .filter((f) => f.endsWith('.tsx') && !f.startsWith('_') && !f.endsWith('.test.tsx'))
    .map((f) => f.replace(/\.tsx$/, '')),
);

/** Waits for the 3D view to finish loading; fails if it reports an error. */
async function expectReady(page: Page) {
  const view = page.locator('.m3d').first();
  await expect(view).toHaveAttribute('data-status', /ready|error/, { timeout: 60_000 });
  await expect(view).toHaveAttribute('data-status', 'ready');
}

test.describe('3D kit gallery', () => {
  test('lists the parts by category and copies the MDX snippet', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${GALLERY}?peca=resistor&qualidade=baixa`);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Galeria de peças 3D' }),
    ).toBeVisible();
    const list = page.getByRole('navigation', { name: 'Peças' });
    await expect(list.getByRole('button')).toHaveCount(PARTS.length);
    await expectReady(page);
    await expect(page.locator('.gallery__code')).toContainText('<Model3D part="resistor"');
    await expectNoHorizontalOverflow(page);
    errors.expectClean();
  });

  test('drops to the low quality on software WebGL and still loads', async ({ page }) => {
    // Switching quality remounts the canvas; the forced context loss of the
    // old one must not mark the view as failed.
    const errors = watchErrors(page);
    await page.goto(`${GALLERY}?peca=multimeter`);
    await expectReady(page);
    await expect(page.locator('.m3d').first()).toHaveAttribute('data-quality', 'baixa');
    await page.waitForTimeout(1500);
    await expect(page.locator('.m3d').first()).toHaveAttribute('data-status', 'ready');
    errors.expectClean();
  });

  test('passes the accessibility checks with a part loaded', async ({ page }) => {
    await page.goto(`${GALLERY}?peca=led&qualidade=baixa`);
    await expectReady(page);
    await expectAccessible(page);
  });
});

test.describe('every part assembles', () => {
  test.skip(({ isMobile }) => isMobile, 'one pass on desktop is enough for the whole kit');

  for (const id of PARTS) {
    test(id, async ({ page }, testInfo) => {
      // Software WebGL on CI renders the larger instruments slowly.
      test.setTimeout(90_000);
      const errors = watchErrors(page);
      await page.goto(`${GALLERY}?peca=${id}&qualidade=baixa`);
      await expectReady(page);
      const viewport = page.locator('.m3d__viewport').first();
      // A page screenshot clipped to the view: element screenshots wait for
      // the element to stop changing, which an animated part never does.
      const shot = async () => page.screenshot({ clip: (await viewport.boundingBox())! });
      await testInfo.attach(`${id}.png`, { body: await shot(), contentType: 'image/png' });

      const explode = page.getByRole('button', { name: 'Vista explodida' });
      if (await explode.isVisible()) {
        await explode.click();
        await expect(explode).toHaveAttribute('aria-pressed', 'true');
        await page.waitForTimeout(1200);
        await testInfo.attach(`${id}-explodida.png`, {
          body: await shot(),
          contentType: 'image/png',
        });
      }
      const notes = page.getByRole('button', { name: 'Anotações' });
      if (await notes.isVisible()) {
        await notes.click();
        await expect(page.locator('.m3d__legend li').first()).toBeVisible();
      }
      errors.expectClean();
    });
  }
});

test.describe('3D model in a lesson', () => {
  test('loads when it scrolls into view and is described for screen readers', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${EXAMPLE_LESSON}?qualidade=baixa`);
    const figure = page.locator('[data-component="Model3D"]');
    await expect(figure).toHaveCount(1);
    await expect(figure.locator('.m3d')).toHaveAttribute('data-part', 'resistor');
    await figure.scrollIntoViewIfNeeded();
    await expectReady(page);
    const viewport = figure.locator('[role="application"]');
    await expect(viewport).toHaveAttribute('aria-roledescription', 'visualizador 3D');
    await expect(figure.locator('figcaption')).toContainText('4,7 kΩ');
    await viewport.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('+');
    errors.expectClean();
  });

  test('shows the poster and a notice without WebGL', async ({ page }) => {
    await page.goto(`${EXAMPLE_LESSON}?sem-webgl`);
    const view = page.locator('[data-component="Model3D"] .m3d');
    await view.scrollIntoViewIfNeeded();
    await expect(view).toHaveAttribute('data-status', 'unsupported');
    await expect(view.getByRole('status')).toContainText('Seu navegador não exibe 3D');
    await expect(view.locator('canvas')).toHaveCount(0);
  });
});

test('the effects page runs smoke, sparks, field lines and current', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('dev/pecas/efeitos/?qualidade=baixa');
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.getByLabel('Faíscas', { exact: true }).check();
  await page.getByRole('button', { name: 'Curto-circuito' }).click();
  await page.getByLabel('Linhas de campo', { exact: true }).check();
  await page.getByLabel('Fonte do campo').selectOption('bobina');
  await page.getByLabel('Corrente no fio', { exact: true }).check();
  await page.waitForTimeout(500);
  errors.expectClean();
});
