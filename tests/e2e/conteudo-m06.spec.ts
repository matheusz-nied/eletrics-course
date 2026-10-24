import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectAccessible, expectNoHorizontalOverflow, watchErrors } from './helpers';

const MODULE = 'm06-corrente-alternada/';

const LESSONS = [
  '01-da-cc-a-ca',
  '02-pico-eficaz-e-medio',
  '03-fase-e-fasores',
  '04-reatancia-e-impedancia',
  '05-potencia-e-fator-de-potencia',
  '06-ressonancia-e-filtros',
  '07-monofasico-bifasico-e-trifasico',
];

const LESSON_7 = `${MODULE}07-monofasico-bifasico-e-trifasico/`;

/**
 * How long an island may take to hydrate: with software WebGL (CI), the 3D
 * view of each lesson blocks the page for a few seconds while it starts.
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
  await expect(island).not.toHaveAttribute('ssr', HYDRATION);
  return island.locator(selector);
}

/** The reading of the multimeter on probe `id`. */
function reading(sim: Locator, id: string) {
  return sim.locator(`.dmm[data-probe="${id}"] [data-reading]`);
}

/** The text alternative of the Bode plot of a simulation. */
function bodeText(sim: Locator) {
  return sim.locator('.sim-chart-box .sim-sr');
}

test.describe('módulo 6: corrente alternada', () => {
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

  test('the generator of lesson 6.1 gives 20 ms and 2,5 cycles at 50 turns per second', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}01-da-cc-a-ca/`);
    const gerador = await widget(page, 'section.gerador');
    await expect(gerador.locator('[data-period]')).toContainText('16,7 ms');
    await expect(gerador.locator('[data-cycles]')).toHaveText('3');
    await gerador.getByRole('slider', { name: /Velocidade/ }).fill('50');
    await expect(gerador.locator('[data-frequency]')).toContainText('50 Hz');
    await expect(gerador.locator('[data-period]')).toContainText('20 ms');
    await expect(gerador.locator('[data-cycles]')).toHaveText('2,5');
    await gerador.getByRole('button', { name: 'Girar' }).click();
    await expect(gerador.getByRole('button', { name: 'Parar' })).toBeVisible();
    errors.expectClean();
  });

  test('the lamp of lesson 6.1 takes the same 0,42 A on the battery and on the generator', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}01-da-cc-a-ca/`);
    const sim = await simulation(page, 'm06/cc-ca-lampada');
    await sim.getByRole('button', { name: 'Iniciar simulação', exact: true }).click();
    await sim.getByRole('tab', { name: 'Multímetro' }).click();
    await expect(reading(sim, 'IL')).toContainText(/41[67]\smA/, { timeout: 10_000 });
    await sim
      .locator('.sim-controls')
      .getByRole('combobox', { name: 'A lâmpada está ligada', exact: true })
      .selectOption({ label: 'Na bateria (CC)' });
    // On the battery the meter goes to DC (A⎓): in AC it would read zero.
    await sim
      .getByRole('radiogroup', { name: 'Modo do multímetro: Corrente na lâmpada' })
      .getByRole('radio', { name: 'A⎓ CC' })
      .click();
    await expect(reading(sim, 'IL')).toContainText(/41[67]\smA/, { timeout: 10_000 });
    errors.expectClean();
  });

  test('the lamps of lesson 6.2 read 127 V and 89,8 V on the meter', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}02-pico-eficaz-e-medio/`);
    const sim = await simulation(page, 'm06/eficaz-lampadas');
    await sim.getByRole('button', { name: 'Iniciar simulação', exact: true }).click();
    await expect(reading(sim, 'V2')).toContainText('127 V', { timeout: 10_000 });
    await expect(reading(sim, 'V3')).toContainText('89,8 V', { timeout: 10_000 });
    errors.expectClean();
  });

  test('the common meter of lesson 6.2 reads 99,7 V on the semi-sine wave', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}02-pico-eficaz-e-medio/`);
    const formas = await widget(page, 'section.formas');
    await expect(formas.locator('[data-meter]')).toHaveText('127 V');
    await formas.locator('label', { hasText: 'Semi-senoidal' }).click();
    await expect(formas.locator('[data-rms]')).toHaveText('127 V');
    await expect(formas.locator('[data-meter]')).toHaveText('99,7 V');
    await formas.locator('label', { hasText: 'Dimmer' }).click();
    await expect(formas.locator('[data-rms]')).toHaveText('89,8 V');
    await expect(formas.locator('[data-meter]')).toHaveText('63,5 V');
    errors.expectClean();
  });

  test('the phasors of lesson 6.3 add to 141 % at 90° and to zero in opposition', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}03-fase-e-fasores/`);
    const fasores = await widget(page, 'section.fasores');
    await fasores.getByRole('button', { name: 'Adiantada 90° (capacitor)' }).click();
    await expect(fasores.locator('[data-shift]')).toContainText('90° adiantada');
    await expect(fasores.locator('[data-sum]')).toContainText('141');
    await fasores.getByRole('button', { name: 'Oposição (180°)' }).click();
    await expect(fasores.locator('[data-sum]')).toHaveText(/^0\s%$/);
    await fasores.getByRole('button', { name: /Girar/ }).click();
    await expect(fasores.getByRole('button', { name: 'Pausar' })).toBeVisible();
    errors.expectClean();
  });

  test('the resistor and the coil of lesson 6.3 draw 102 mA together, not 141 mA', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}03-fase-e-fasores/`);
    const sim = await simulation(page, 'm06/fase-ramos');
    await sim.getByRole('button', { name: 'Iniciar simulação', exact: true }).click();
    await expect(reading(sim, 'IT')).toContainText('70,7 mA', { timeout: 15_000 });
    await sim
      .locator('.sim-controls')
      .getByRole('switch', { name: /Ramo da bobina/ })
      .click();
    await expect(reading(sim, 'IT')).toContainText('102 mA', { timeout: 15_000 });
    errors.expectClean();
  });

  test('the capacitor current of lesson 6.4 grows ten times from 60 Hz to 600 Hz', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}04-reatancia-e-impedancia/`);
    const sim = await simulation(page, 'm06/reatancia-frequencia');
    await sim.getByRole('button', { name: 'Iniciar simulação', exact: true }).click();
    await expect(reading(sim, 'IC')).toContainText('26,7 mA', { timeout: 15_000 });
    await expect(reading(sim, 'IR')).toContainText('70,7 mA');
    // The slider runs 50 → 1.000 Hz over 0 → 1.000 steps: 600 Hz is step 579.
    await sim
      .locator('.sim-controls')
      .getByRole('slider', { name: 'Frequência do gerador' })
      .fill('579');
    await expect(reading(sim, 'IC')).toContainText('267 mA', { timeout: 15_000 });
    await expect(reading(sim, 'IL')).toContainText('18,7 mA', { timeout: 15_000 });
    errors.expectClean();
  });

  test('the correction capacitor of lesson 6.5 lowers the mains current', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}05-potencia-e-fator-de-potencia/`);
    const sim = await simulation(page, 'm06/fator-de-potencia-motor');
    await sim.getByRole('button', { name: 'Iniciar simulação', exact: true }).click();
    await expect(reading(sim, 'IT')).toContainText('5,59 A', { timeout: 10_000 });
    await expect(reading(sim, 'P')).toContainText('500 W');
    const controls = sim.locator('.sim-controls');
    await controls.getByRole('switch', { name: /Capacitor de correção ligado/ }).click();
    await expect(reading(sim, 'IT')).toContainText('4,46 A', { timeout: 10_000 });
    await controls
      .getByRole('combobox', { name: 'Capacitância de correção', exact: true })
      .selectOption({ label: '80 µF' });
    await expect(reading(sim, 'IT')).toContainText('3,97 A', { timeout: 10_000 });
    await expect(reading(sim, 'IM')).toContainText('5,59 A');
    await expect(reading(sim, 'P')).toContainText('500 W');
    errors.expectClean();
  });

  test('the power triangle of lesson 6.5 reaches 0,92 with 47 µF on the pump', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}05-potencia-e-fator-de-potencia/`);
    const tri = await widget(page, 'section.tri-pot');
    await expect(tri.locator('[data-pf]')).toHaveText('0,71');
    await expect(tri.locator('[data-current]')).toContainText('5,55 A');
    await expect(tri.locator('[data-capacitors]')).toContainText('46,5 µF');
    await expect(tri.locator('[data-capacitors]')).toContainText('81,6 µF');
    await tri.getByRole('slider', { name: /Capacitor em paralelo/ }).fill('47');
    await expect(tri.locator('[data-pf]')).toHaveText('0,92');
    await expect(tri.locator('[data-current]')).toContainText('4,27 A');
    await tri.locator('label', { hasText: 'Chuveiro' }).click();
    await expect(tri.getByRole('radio', { name: 'Chuveiro' })).toBeChecked();
    await expect(tri.locator('[data-capacitors]')).toContainText('não há o que corrigir');
    errors.expectClean();
  });

  test('the RC filter of lesson 6.6 cuts near 59 Hz', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}06-ressonancia-e-filtros/`);
    const sim = await simulation(page, 'm06/filtro-rc-bode');
    await expect(bodeText(sim)).toContainText(/Frequência de corte: 5[89](,\d+)?\sHz/, {
      timeout: 10_000,
    });
    errors.expectClean();
  });

  test('more resistance flattens the RLC of lesson 6.6', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}06-ressonancia-e-filtros/`);
    const sim = await simulation(page, 'm06/rlc-ressonancia');
    await expect(bodeText(sim)).toContainText('Ganho de −31,9 dB em 40 Hz', { timeout: 10_000 });
    await sim
      .locator('.sim-controls')
      .getByRole('combobox', { name: 'Resistor R', exact: true })
      .selectOption({ label: '100 Ω' });
    await expect(bodeText(sim)).toContainText('Ganho de −12,2 dB em 40 Hz', { timeout: 10_000 });
    errors.expectClean();
  });

  test('the crossover of lesson 6.6 cuts the woofer near 2,7 kHz', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}06-ressonancia-e-filtros/`);
    const sim = await simulation(page, 'm06/divisor-frequencias');
    await expect(bodeText(sim)).toContainText(/Frequência de corte: 2,7\d*\skHz/, {
      timeout: 10_000,
    });
    errors.expectClean();
  });

  test('the phasors put 220 V between two phases and 380 V in a 220/380 V supply', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto(LESSON_7);
    const tri = await widget(page, 'section.trifasico');
    await expect(tri.locator('[data-phase-rms]')).toHaveText('127 V');
    await expect(tri.locator('[data-line-rms]')).toHaveText('220 V');
    await tri.getByRole('slider', { name: /Instante/ }).fill('90');
    await expect(tri.locator('[data-now]')).toHaveText('L1: 180 V · L2: −90 V · L3: −90 V');
    await expect(tri.locator('[data-sum]')).toHaveText('L1 + L2 + L3 = 0 V');
    await tri.locator('label', { hasText: '220/380 V' }).click();
    await expect(tri.getByRole('radio', { name: '220/380 V' })).toBeChecked();
    await expect(tri.locator('[data-phase-rms]')).toHaveText('220 V');
    await expect(tri.locator('[data-line-rms]')).toHaveText('380 V');
    errors.expectClean();
  });

  test('the three-phase supply reads 127 V and 220 V, and the neutral carries the unbalance', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto(LESSON_7);
    const sim = await simulation(page, 'm06/trifasico');
    await sim.getByRole('button', { name: 'Iniciar simulação', exact: true }).click();
    await expect(reading(sim, 'V1N')).toContainText(/:\s12[67]\sV/, { timeout: 10_000 });
    await expect(reading(sim, 'V12')).toContainText(/:\s2(19|20)\sV/, { timeout: 10_000 });
    await expect(reading(sim, 'IN')).toContainText('mA', { timeout: 10_000 });
    await sim
      .locator('.sim-controls')
      .getByRole('switch', { name: /Lâmpada da fase L3 ligada/ })
      .click();
    await expect(reading(sim, 'IN')).toContainText(/7[89]\d\smA/, { timeout: 10_000 });
    errors.expectClean();
  });

  test('breaking the neutral of the two-phase house burns the small lamp', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(LESSON_7);
    const sim = await simulation(page, 'm06/neutro-rompido');
    await sim.getByRole('button', { name: 'Iniciar simulação', exact: true }).click();
    await expect(reading(sim, 'VL')).toContainText(/:\s12[67]\sV/, { timeout: 10_000 });
    await sim
      .locator('.sim-controls')
      .getByRole('switch', { name: /Neutro ligado/ })
      .click();
    await expect(reading(sim, 'VL')).toContainText(/:\s2(19|20)\sV/, { timeout: 15_000 });
    await expect(reading(sim, 'VH')).not.toContainText(/:\s\d{2,3}\sV/);
    errors.expectClean();
  });
});
