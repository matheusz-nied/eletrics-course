import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectAccessible, expectNoHorizontalOverflow, watchErrors } from './helpers';

const MODULE = 'm10-fontes/';

const LESSONS = [
  '01-fonte-linear',
  '02-fontes-chaveadas',
  '03-baterias-e-nobreak',
  '04-energia-solar',
];

/**
 * How long an island may take to hydrate. Lessons with a 3D model and
 * simulations take several seconds on a loaded runner (software WebGL).
 */
const HYDRATION = { timeout: 20_000 };

/** Scrolls through the page so every island hydrates, and waits for the simulations. */
async function hydrateAll(page: Page) {
  for (const island of await page.locator('astro-island').all()) {
    await island.scrollIntoViewIfNeeded();
    await expect(island).not.toHaveAttribute('ssr', HYDRATION);
  }
  for (const sim of await page.locator('[data-simulation]').all()) {
    await expect(sim).toHaveAttribute('data-ready', '');
  }
}

/** The hydrated island that contains `inner`. */
async function hydrated(page: Page, inner: string): Promise<Locator> {
  const island = page.locator(`astro-island:has(${inner})`).first();
  await island.scrollIntoViewIfNeeded();
  await expect(island).not.toHaveAttribute('ssr', HYDRATION);
  return island.locator(inner).first();
}

test.describe('módulo 10: fontes de alimentação', () => {
  test('the module page lists the four lessons', async ({ page }) => {
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

  test('the LM317 of lesson 10.1 keeps 1,25 V across R1', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}01-fonte-linear/`);
    const sim = page.locator('[data-simulation="m10/lm317"]');
    await sim.scrollIntoViewIfNeeded();
    await expect(sim).toHaveAttribute('data-ready', '');
    await expect(sim.locator('.dmm[data-probe="VR1"] [data-reading]')).toContainText(/1,2\d\sV/);
    errors.expectClean();
  });

  test('the battery calculator of lesson 10.3 gives 19 h for the gate and minutes for the nobreak', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}03-baterias-e-nobreak/`);
    const widget = await hydrated(page, '.autonomia');
    await expect(widget.locator('.autonomia__main')).toHaveText('19 h');
    await widget.getByLabel('Nobreak na tomada').check({ force: true });
    await expect(widget.locator('.autonomia__main')).toContainText('min');
    errors.expectClean();
  });

  test('the panel curve of lesson 10.4 shows 330 W and drops when a cell is shaded', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}04-energia-solar/`);
    const widget = await hydrated(page, '.cpainel');
    await expect(widget.locator('.lw__status')).toContainText('Curva normal');
    await expect(widget.locator('.cpainel__values')).toContainText(/33[01]\sW/);
    await widget.getByLabel('Sombra numa célula').fill('100');
    await expect(widget.locator('.lw__status')).toContainText('mais de um pico');
    await expect(widget.locator('.cpainel__values')).toContainText('215 W');
    await widget.getByLabel('Diodos de bypass na caixa de junção').uncheck({ force: true });
    await expect(widget.locator('.lw__status')).toContainText('Ponto quente');
    errors.expectClean();
  });
});
