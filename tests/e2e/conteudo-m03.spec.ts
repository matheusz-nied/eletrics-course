import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectAccessible, expectNoHorizontalOverflow, watchErrors } from './helpers';

const MODULE = 'm03-medicoes/';

const LESSONS = [
  '01-multimetro',
  '02-medindo-tensao',
  '03-medindo-corrente',
  '04-resistencia-continuidade-e-diodo',
  '05-osciloscopio',
  '06-protoboard-e-fonte-de-bancada',
];

/** Scrolls through the page so every island hydrates, and waits for the simulations. */
async function hydrateAll(page: Page) {
  for (const island of await page.locator('astro-island').all()) {
    await island.scrollIntoViewIfNeeded();
    await expect(island).not.toHaveAttribute('ssr');
  }
  for (const sim of await page.locator('[data-simulation]').all()) {
    await expect(sim).toHaveAttribute('data-ready', '');
  }
}

/** The hydrated island that contains `inner`. */
async function hydrated(page: Page, inner: string): Promise<Locator> {
  const island = page.locator(`astro-island:has(${inner})`).first();
  await island.scrollIntoViewIfNeeded();
  await expect(island).not.toHaveAttribute('ssr');
  return island.locator(inner).first();
}

test.describe('módulo 3: medições e instrumentos', () => {
  test('the module page lists the six lessons', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(MODULE);
    for (const slug of LESSONS) {
      await expect(page.locator(`a[href$="/${MODULE}${slug}/"]`).first()).toBeVisible();
    }
    errors.expectClean();
  });

  for (const slug of LESSONS) {
    test(`lesson ${slug} loads its simulations and widgets without errors`, async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto(`${MODULE}${slug}/`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await hydrateAll(page);
      await expectNoHorizontalOverflow(page);
      await expectAccessible(page);
      errors.expectClean();
    });
  }

  test('the multimeter trainer of lesson 3.1 reads an AA cell in V⎓', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}01-multimetro/`);
    const trainer = await hydrated(page, '[data-trainer="multimetro"]');
    await trainer.locator('label.mt-chip', { has: page.locator('input[value="vdc"]') }).click();
    await expect(trainer.locator('.mt-reading')).toContainText(/1,58\d*\sV/);
    errors.expectClean();
  });

  test('the bench supply of lesson 3.6 lights the 12 V lamp in CV mode', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}06-protoboard-e-fonte-de-bancada/`);
    const supply = await hydrated(page, '.bs');
    await supply.getByRole('button', { name: 'Ligar a saída (OUTPUT)' }).click();
    await expect(supply.locator('.bs-reading')).toContainText(/0,417\sA · modo CV/);
    errors.expectClean();
  });
});
