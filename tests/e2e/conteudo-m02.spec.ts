import { expect, test, type Page } from '@playwright/test';
import { expectAccessible, expectNoHorizontalOverflow, watchErrors } from './helpers';

const MODULE = 'm02-circuitos-cc/';

const LESSONS = [
  '01-o-circuito-eletrico',
  '02-associacao-em-serie',
  '03-associacao-em-paralelo',
  '04-circuitos-mistos',
  '05-leis-de-kirchhoff',
  '06-divisores-de-tensao-e-corrente',
  '07-fontes-reais-e-baterias',
  '08-thevenin-norton-e-superposicao',
  '09-maxima-transferencia-de-potencia',
];

/** Scrolls through the page so every simulation hydrates, and waits for them. */
async function hydrateAll(page: Page) {
  const sims = page.locator('[data-simulation]');
  for (const sim of await sims.all()) {
    await sim.scrollIntoViewIfNeeded();
    await expect(sim).toHaveAttribute('data-ready', '');
  }
}

test.describe('módulo 2: circuitos de corrente contínua', () => {
  test('the module page lists the nine lessons', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(MODULE);
    for (const slug of LESSONS) {
      await expect(page.locator(`a[href$="/${MODULE}${slug}/"]`).first()).toBeVisible();
    }
    errors.expectClean();
  });

  for (const slug of LESSONS) {
    test(`lesson ${slug} loads its simulations without errors`, async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto(`${MODULE}${slug}/`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await hydrateAll(page);
      await expectNoHorizontalOverflow(page);
      await expectAccessible(page);
      errors.expectClean();
    });
  }

  test('closing the switch of lesson 2.1 lights the lamp at about 0,42 A', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}01-o-circuito-eletrico/`);
    const sim = page.locator('[data-simulation="m02/circuito-basico"]');
    await sim.scrollIntoViewIfNeeded();
    await expect(sim).toHaveAttribute('data-ready', '');
    await sim.locator('.sim-controls').getByRole('switch', { name: 'Chave S1' }).click();
    await expect(sim.locator('.dmm[data-probe="IL"] [data-reading]')).toContainText(/41\d\smA/);
    errors.expectClean();
  });
});
