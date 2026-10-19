import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectAccessible, expectNoHorizontalOverflow, watchErrors } from './helpers';

const MODULE = 'm07-instalacoes/';

const LESSONS = ['05-tomadas-e-plugues', '06-interruptores'];

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

/** The hydrated lesson widget whose root has `selector`. */
async function widget(page: Page, selector: string) {
  const island = page.locator(`astro-island:has(${selector})`).first();
  await island.scrollIntoViewIfNeeded();
  await expect(island).not.toHaveAttribute('ssr');
  return island.locator(selector);
}

/** The reading of the multimeter on probe `id`. */
function reading(sim: Locator, id: string) {
  return sim.locator(`.dmm[data-probe="${id}"] [data-reading]`);
}

test.describe('módulo 7: tomadas e interruptores', () => {
  for (const slug of LESSONS) {
    test(`lesson ${slug} loads its simulations and widgets without errors`, async ({ page }) => {
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

  test('the outlet tester of lesson 7.5 shows each wiring', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}05-tomadas-e-plugues/`);
    const tester = await widget(page, 'section.tt');
    await expect(tester.locator('[data-reading="F-N"]')).toHaveText('127 V');
    await expect(tester.locator('[data-reading="F-T"]')).toHaveText('127 V');
    await expect(tester.locator('[data-lamp="N-T"]')).toHaveAttribute('data-lit', 'nao');
    await tester.getByText('Fase e terra trocados (fase no pino terra)').click();
    await expect(tester.locator('[data-verdict]')).toHaveAttribute('data-verdict', 'fase-no-terra');
    await expect(tester.locator('[data-lamp="F-N"]')).toHaveAttribute('data-lit', 'nao');
    await expect(tester.locator('[data-lamp="N-T"]')).toHaveAttribute('data-lit', 'sim');
    await tester.getByText('Tomada de 220 V com duas fases').click();
    await expect(tester.locator('[data-reading="F-N"]')).toHaveText('220 V');
    errors.expectClean();
  });

  test('the loose contact of lesson 7.5 heats about 12 W with the same current', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}05-tomadas-e-plugues/`);
    const sim = await simulation(page, 'm07/tomada-mau-contato');
    await expect(reading(sim, 'I')).toContainText(/11,[12]\d?\s?A/, { timeout: 10_000 });
    await sim
      .locator('.sim-controls')
      .getByRole('combobox', { name: 'Contato da tomada', exact: true })
      .selectOption({ label: 'Frouxo (0,1 Ω)' });
    await expect(reading(sim, 'I')).toContainText(/11,[01]\d?\s?A/, { timeout: 10_000 });
    errors.expectClean();
  });

  test('either switch of the staircase in lesson 7.6 changes the lamp', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}06-interruptores/`);
    const sim = await simulation(page, 'm07/escada-paralelo');
    const current = reading(sim, 'IL');
    await expect(current).toContainText(/47\d\smA/, { timeout: 10_000 });
    const controls = sim.locator('.sim-controls');
    await controls.getByRole('switch', { name: /Interruptor de baixo/ }).click();
    await expect(current).not.toContainText(/47\d\smA/, { timeout: 10_000 });
    await controls.getByRole('switch', { name: /Interruptor de cima/ }).click();
    await expect(current).toContainText(/47\d\smA/, { timeout: 10_000 });
    errors.expectClean();
  });

  test('the wiring widget of lesson 7.6 accepts the classic wiring and flags the short', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}06-interruptores/`);
    const mp = await widget(page, 'section.mp');
    await mp.getByRole('button', { name: 'Mostrar a ligação clássica' }).click();
    await expect(mp.locator('[data-now]')).toHaveAttribute('data-now', 'acesa');
    await mp.getByRole('button', { name: /Virar o interruptor 1/ }).click();
    await expect(mp.locator('[data-now]')).toHaveAttribute('data-now', 'apagada');
    await mp.getByRole('button', { name: /Virar o interruptor 2/ }).click();
    await expect(mp.locator('[data-now]')).toHaveAttribute('data-now', 'acesa');
    await mp.getByRole('button', { name: 'Testar as quatro posições' }).click();
    await expect(mp.locator('[data-verdict]')).toHaveAttribute('data-verdict', 'correta');

    await mp
      .getByRole('combobox', { name: 'Interruptor 2, borne C (comum)' })
      .selectOption('neutro');
    await expect(mp.locator('[data-verdict]')).toHaveAttribute('data-verdict', 'curto');
    await expect(mp.locator('[data-now]')).toHaveAttribute('data-now', 'curto');
    errors.expectClean();
  });
});
