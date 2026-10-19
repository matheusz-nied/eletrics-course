import { expect, test, type Page } from '@playwright/test';
import { expectAccessible, expectNoHorizontalOverflow, watchErrors } from './helpers';

const MODULE = 'm04-passivos/';

const LESSONS = [
  '01-resistores',
  '02-resistores-variaveis',
  '03-capacitores',
  '04-circuito-rc',
  '05-indutores-e-circuito-rl',
  '06-fusiveis-e-protecao',
  '07-chaves-botoes-e-reles',
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

/** The simulation `id`, scrolled into view and ready. */
async function simulation(page: Page, id: string) {
  const sim = page.locator(`[data-simulation="${id}"]`);
  await sim.scrollIntoViewIfNeeded();
  await expect(sim).toHaveAttribute('data-ready', '');
  return sim;
}

test.describe('módulo 4: componentes passivos', () => {
  test('the module page lists the seven lessons', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(MODULE);
    for (const slug of LESSONS) {
      await expect(page.locator(`a[href$="/${MODULE}${slug}/"]`).first()).toBeVisible();
    }
    errors.expectClean();
  });

  for (const slug of LESSONS) {
    test(`lesson ${slug} loads its simulations and widgets without errors`, async ({ page }) => {
      // Lesson 4.3 has five 3D models; with software WebGL (CI) each canvas
      // blocks the page for a few seconds while its shaders compile.
      test.setTimeout(90_000);
      const errors = watchErrors(page);
      await page.goto(`${MODULE}${slug}/`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await hydrateAll(page);
      await expectNoHorizontalOverflow(page);
      await expectAccessible(page);
      errors.expectClean();
    });
  }

  test('the colour code game of lesson 4.1 accepts 220 Ω for red, red, brown', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}01-resistores/`);
    const island = page.locator('astro-island:has([data-widget="codigo-de-cores"])').first();
    await island.scrollIntoViewIfNeeded();
    await expect(island).not.toHaveAttribute('ssr');
    const game = island.locator('[data-widget="codigo-de-cores"]');
    await game.getByLabel('Valor do resistor').fill('220');
    await game.getByRole('button', { name: 'Conferir' }).click();
    await expect(game).toContainText('Certo.');
    errors.expectClean();
  });

  test('a 4 A overload blows the 2 A fuse of lesson 4.6', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}06-fusiveis-e-protecao/`);
    const sim = await simulation(page, 'm04/fusivel-sobrecarga');
    await sim
      .locator('.sim-controls')
      .getByRole('combobox', { name: 'Carga' })
      .selectOption({ label: 'Sobrecarga (4 A)' });
    await expect(sim.locator('.sim-events')).toContainText('rompeu', { timeout: 10_000 });
    errors.expectClean();
  });

  test('the latching switch of lesson 4.7 pulls the relay and lights the headlights', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}07-chaves-botoes-e-reles/`);
    const sim = await simulation(page, 'm04/rele-farol');
    await sim.getByRole('button', { name: 'Iniciar simulação', exact: true }).click();
    await sim.locator('.sim-controls').getByRole('switch', { name: 'Chave com retenção' }).click();
    await expect(sim.locator('.dmm[data-probe="IC"] [data-reading]')).toContainText(/1[45]\d\smA/);
    await expect(sim.locator('.dmm[data-probe="IF"] [data-reading]')).toContainText(
      /9,[23]\d*\sA/,
      {
        timeout: 10_000,
      },
    );
    errors.expectClean();
  });
});
