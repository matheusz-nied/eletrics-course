import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectAccessible, expectNoHorizontalOverflow, watchErrors } from './helpers';

/** With software WebGL (CI) each 3D canvas blocks the page while its shaders compile. */
const HYDRATION = { timeout: 20_000 };

const MODULE = 'm07-instalacoes/';

const LESSONS = ['01-da-rua-ate-a-tomada', '04-fios-e-cabos'];

/** Scrolls through the page so every island hydrates, and waits for the simulations. */
async function hydrateAll(page: Page) {
  for (const island of await page.locator('astro-island').all()) {
    await island.scrollIntoViewIfNeeded();
    await expect(island).not.toHaveAttribute('ssr', HYDRATION);
  }
  for (const sim of await page.locator('[data-simulation]').all()) {
    await expect(sim).toHaveAttribute('data-ready', '', HYDRATION);
  }
}

/** The simulation `id`, scrolled into view and ready. */
async function simulation(page: Page, id: string) {
  const sim = page.locator(`[data-simulation="${id}"]`);
  await sim.scrollIntoViewIfNeeded();
  await expect(sim).toHaveAttribute('data-ready', '', HYDRATION);
  return sim;
}

/** The hydrated lesson widget whose root has `selector`. */
async function widget(page: Page, selector: string) {
  const island = page.locator(`astro-island:has(${selector})`).first();
  await island.scrollIntoViewIfNeeded();
  await expect(island).not.toHaveAttribute('ssr', HYDRATION);
  return island.locator(selector);
}

/** A current meter on a switched-off circuit: zero, or the leakage of open contacts. */
const OFF = /:\s(0\sA|[\d,]+\s[nµ]A)\s/;

/** The reading of the multimeter on probe `id`. */
function reading(sim: Locator, id: string) {
  return sim.locator(`.dmm[data-probe="${id}"] [data-reading]`);
}

test.describe('módulo 7: instalações (aulas 7.1 e 7.4)', () => {
  for (const slug of LESSONS) {
    test(`lesson ${slug} loads its simulations and widgets without errors`, async ({ page }) => {
      // With software WebGL (CI) each 3D canvas blocks the page while its shaders compile.
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

  test('the main breaker of lesson 7.1 carries the sum of the circuits, and an overload trips only its own', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await page.goto(`${MODULE}01-da-rua-ate-a-tomada/`);
    const sim = await simulation(page, 'm07/quadro-da-casa');
    const controls = sim.locator('.sim-controls');
    await sim.getByRole('button', { name: 'Iniciar simulação', exact: true }).click();
    await expect(reading(sim, 'IG')).toContainText(OFF, { timeout: 10_000 });

    await controls.getByRole('switch', { name: /Luzes acesas/ }).click();
    await controls.getByRole('switch', { name: /Aparelhos ligados nas tomadas/ }).click();
    await controls.getByRole('switch', { name: /Chuveiro ligado/ }).click();
    await expect(reading(sim, 'I1')).toContainText('908 mA', { timeout: 10_000 });
    await expect(reading(sim, 'I2')).toContainText('2 A');
    await expect(reading(sim, 'I3')).toContainText('24,9 A');
    await expect(reading(sim, 'IG')).toContainText('27,8 A');

    await controls
      .getByRole('combobox', { name: 'O que está ligado nas tomadas' })
      .selectOption({ label: 'Tudo junto (6.600 W)' });
    await expect(reading(sim, 'I2')).toContainText('29,9 A', { timeout: 10_000 });
    await expect(reading(sim, 'IG')).toContainText('55,7 A');
    // About 80 s of simulation at 10× speed: the outlets breaker trips, the rest stays on.
    await expect(reading(sim, 'I2')).toContainText(OFF, { timeout: 60_000 });
    await expect(reading(sim, 'IG')).toContainText('25,8 A', { timeout: 10_000 });

    await controls.getByRole('switch', { name: /Disjuntor geral/ }).click();
    await expect(reading(sim, 'IG')).toContainText(OFF, { timeout: 10_000 });
    errors.expectClean();
  });

  test('the calculator of lesson 7.4 sizes the 7.500 W shower at 220 V and at 127 V', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}04-fios-e-cabos/`);
    const calc = await widget(page, 'section.calc-circuito');
    const result = (name: string) => calc.locator(`[data-result="${name}"]`);

    await expect(result('corrente')).toHaveText('34,1 A');
    await expect(result('disjuntor')).toHaveText('40 A');
    await expect(result('queda')).toContainText('2,93 V (1,33 %)');
    await expect(result('veredito')).toContainText('Use fio de 6 mm² com disjuntor de 40 A.');

    await calc.locator('label', { hasText: /^127 V$/ }).click();
    await expect(result('corrente')).toHaveText('59,1 A');
    await expect(result('disjuntor')).toHaveText('63 A');
    await expect(result('veredito')).toContainText('Use fio de 16 mm² com disjuntor de 63 A.');

    await calc.getByRole('button', { name: 'Tomadas da cozinha 2.200 W' }).click();
    await calc.getByRole('slider', { name: /Comprimento/ }).fill('40');
    await expect(result('corrente')).toHaveText('17,3 A');
    await expect(result('veredito')).toContainText('Use fio de 6 mm² com disjuntor de 20 A.');
    await expect(result('veredito')).toContainText(/7,5\d? %/);
    errors.expectClean();
  });
});
