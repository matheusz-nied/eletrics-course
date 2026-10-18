import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectAccessible, expectNoHorizontalOverflow, watchErrors } from './helpers';

const MODULE = 'm05-magnetismo/';

const LESSONS = [
  '01-imas-e-campo-magnetico',
  '02-eletroimas-e-solenoides',
  '03-inducao-eletromagnetica',
  '04-transformadores',
  '05-sensores-magneticos',
  '06-reles-e-contatores',
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

/** Holds the push button `name` of the control panel down with the keyboard. */
async function hold(page: Page, sim: Locator, name: RegExp) {
  const button = sim.locator('.sim-controls').getByRole('button', { name });
  await button.focus();
  await page.keyboard.down(' ');
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  return async () => {
    await page.keyboard.up(' ');
    await expect(button).toHaveAttribute('aria-pressed', 'false');
  };
}

test.describe('módulo 5: magnetismo e eletromagnetismo', () => {
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

  test('the gate lock of lesson 5.2 gets less current through a long thin cable', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}02-eletroimas-e-solenoides/`);
    const sim = await simulation(page, 'm05/fechadura-portao-social');
    let release = await hold(page, sim, /Botão do porteiro/);
    await expect(reading(sim, 'IF')).toContainText(/9[34]\d\smA/);
    await release();
    await sim
      .locator('.sim-controls')
      .getByRole('combobox', { name: 'Cabo da casa até o portão' })
      .selectOption({ label: 'Cabo de interfone (0,40 mm), 40 m' });
    release = await hold(page, sim, /Botão do porteiro/);
    await expect(reading(sim, 'IF')).toContainText(/5[23]\d\smA/);
    await release();
    errors.expectClean();
  });

  test('the magnet passing through the coil of lesson 5.3 draws a voltage pulse', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}03-inducao-eletromagnetica/`);
    const inducao = await widget(page, 'section.inducao');
    await inducao.getByRole('button', { name: 'Passar o ímã pela bobina' }).click();
    await expect(inducao.locator('[data-peak]')).toContainText('2,02 V', { timeout: 10_000 });
    errors.expectClean();
  });

  test('the transformer of lesson 5.4 doubles its output on the wrong tap', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}04-transformadores/`);
    const sim = await simulation(page, 'm05/trafo-central');
    await sim.getByRole('button', { name: 'Iniciar simulação', exact: true }).click();
    await expect(reading(sim, 'VS')).toContainText('12,1 V', { timeout: 10_000 });
    await sim
      .locator('.sim-controls')
      .getByRole('combobox', { name: 'Chave seletora do trafo', exact: true })
      .selectOption({ label: 'Posição 127 V' });
    await expect(reading(sim, 'VS')).toContainText('21,1 V', { timeout: 10_000 });
    errors.expectClean();
  });

  test('the reed switch of lesson 5.5 closes near the magnet and opens far from it', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}05-sensores-magneticos/`);
    const sensor = await widget(page, '.ima-sensor');
    const distance = sensor.getByRole('slider', { name: /Distância do ímã/ });
    const states = sensor.locator('.ima-sensor__states');
    await distance.fill('15');
    await expect(states).toContainText('Reed: fechado');
    await distance.fill('18');
    await expect(states).toContainText('Reed: fechado');
    await distance.fill('20');
    await expect(states).toContainText('Reed: aberto');
    errors.expectClean();
  });

  test('opening a door of lesson 5.5 breaks the alarm loop', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}05-sensores-magneticos/`);
    const sim = await simulation(page, 'm05/alarme-porta');
    await sim.getByRole('button', { name: 'Iniciar simulação', exact: true }).click();
    await expect(reading(sim, 'IL')).toContainText(/30,\d\smA/, { timeout: 10_000 });
    await sim
      .locator('.sim-controls')
      .getByRole('switch', { name: /Porta da frente fechada/ })
      .click();
    await expect(reading(sim, 'IL')).not.toContainText('mA', { timeout: 10_000 });
    errors.expectClean();
  });

  test('the seal of lesson 5.6 holds K1 and the interlock blocks K2', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}06-reles-e-contatores/`);
    const sim = await simulation(page, 'm05/partida-selo-intertravamento');
    await sim.getByRole('button', { name: 'Iniciar simulação', exact: true }).click();
    const current = reading(sim, 'IT');

    let release = await hold(page, sim, /B1 Liga sentido 1/);
    await expect(current).toContainText(/22\d\smA/, { timeout: 10_000 });
    await release();
    await expect(current).toContainText(/22\d\smA/);

    release = await hold(page, sim, /B2 Liga sentido 2/);
    await page.waitForTimeout(500);
    await expect(current).toContainText(/22\d\smA/);
    await release();

    release = await hold(page, sim, /B0 Desliga/);
    await expect(current).not.toContainText('mA', { timeout: 10_000 });
    await release();
    await expect(current).not.toContainText('mA');
    errors.expectClean();
  });
});
