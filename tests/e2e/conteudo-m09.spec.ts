import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectAccessible, expectNoHorizontalOverflow, watchErrors } from './helpers';

const MODULE = 'm09-semicondutores/';

const LESSONS = [
  '01-juncao-pn',
  '02-diodo',
  '03-retificadores',
  '04-leds',
  '05-diodo-zener',
  '06-transistor-como-chave',
  '07-transistor-como-amplificador',
  '08-mosfet',
  '09-tiristores-e-isolamento',
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

test.describe('módulo 9: semicondutores', () => {
  test('the module page lists the nine lessons', async ({ page }) => {
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

  test('the PN junction of lesson 9.1 blocks in reverse and conducts at +0,7 V', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}01-juncao-pn/`);
    const widget = await hydrated(page, '.jpn');
    await widget.getByRole('button', { name: '−10 V', exact: true }).click();
    await expect(widget.locator('.lw__status')).toContainText('Bloqueia');
    await expect(widget.locator('.jpn__values')).toContainText('1,67 µm');
    await widget.getByRole('button', { name: '+0,7 V', exact: true }).click();
    await expect(widget.locator('.lw__status')).toContainText('Conduz');
    await expect(widget.locator('.jpn__values')).toContainText('11,2 mA');
    errors.expectClean();
  });
});
