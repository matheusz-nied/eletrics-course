import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectAccessible, expectNoHorizontalOverflow, watchErrors } from './helpers';

const MODULE = 'm08-motores/';

const LESSONS = [
  '01-motor-cc',
  '02-ponte-h-e-pwm',
  '03-motor-de-inducao-trifasico',
  '04-motor-monofasico-capacitor',
  '05-passo-servo-e-brushless',
  '06-redutores-torque-e-potencia',
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

test.describe('módulo 8: motores elétricos', () => {
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
      // With software WebGL (CI) each 3D canvas blocks the page while its shaders compile.
      test.setTimeout(120_000);
      const errors = watchErrors(page);
      await page.goto(`${MODULE}${slug}/`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await hydrateAll(page);
      await expectNoHorizontalOverflow(page);
      await expectAccessible(page);
      errors.expectClean();
    });
  }

  test('the rotating field of lesson 8.3 reverses when two phases swap', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}03-motor-de-inducao-trifasico/`);
    const campo = await widget(page, 'section.campo');
    const sense = campo.locator('[data-sentido]');
    const before = await sense.getAttribute('data-sentido');
    await campo.getByRole('radio', { name: 'L2 e L3 trocadas' }).check();
    await expect(sense).toHaveAttribute('data-sentido', String(-Number(before)));
    await campo.getByRole('radio', { name: 'Faltando a fase L3' }).check();
    await expect(sense).toHaveAttribute('data-sentido', '0');
    errors.expectClean();
  });

  test('the three-phase motor of lesson 8.3 draws more current on two phases', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    await page.goto(`${MODULE}03-motor-de-inducao-trifasico/`);
    const sim = await simulation(page, 'm08/estrela-triangulo');
    await sim.getByRole('button', { name: 'Iniciar simulação', exact: true }).click();
    await expect(reading(sim, 'I1')).toContainText(/1,9\d\sA/, { timeout: 30_000 });
    await sim
      .locator('.sim-controls')
      .getByRole('switch', { name: /Fase L3 ligada/ })
      .click();
    await expect(reading(sim, 'I1')).toContainText(/3,[2-4]\d\sA/, { timeout: 30_000 });
    errors.expectClean();
  });

  test('the fan motor of lesson 8.4 only hums with an open capacitor', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    await page.goto(`${MODULE}04-motor-monofasico-capacitor/`);
    const sim = await simulation(page, 'm08/motor-capacitor');
    await sim
      .locator('.sim-controls')
      .getByRole('combobox', { name: 'Estado do capacitor', exact: true })
      .selectOption({ label: 'Aberto' });
    await sim.getByRole('button', { name: 'Iniciar simulação', exact: true }).click();
    await expect(reading(sim, 'IM')).toContainText(/6,[12]\d\sA/, { timeout: 30_000 });
    errors.expectClean();
  });

  test('the stepper of lesson 8.5 moves 1,8° per full step and 0,9° per half step', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}05-passo-servo-e-brushless/`);
    const passo = await widget(page, 'section.passo');
    const angle = passo.locator('[data-angulo]');
    const forward = passo.getByRole('button', { name: /Passo à frente/ });
    await forward.click();
    await forward.click();
    await expect(angle).toHaveText('3,6°');
    await passo.getByRole('radio', { name: /Meio passo/i }).check();
    await expect(angle).toHaveText('0°');
    await forward.click();
    await expect(angle).toHaveText('0,9°');
    errors.expectClean();
  });

  test('the servo of lesson 8.5 goes to 90° with a 1,5 ms pulse', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}05-passo-servo-e-brushless/`);
    const servo = await widget(page, 'section.servo');
    await servo.getByRole('slider', { name: /Largura do pulso/ }).fill('1.5');
    await expect(servo.locator('[data-servo-angulo]')).toHaveText('90°');
    await servo.getByRole('slider', { name: /Largura do pulso/ }).fill('2');
    await expect(servo.locator('[data-servo-angulo]')).toHaveText('180°');
    errors.expectClean();
  });

  test('the reducer calculator of lesson 8.6 follows the gate motor to the rack', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}06-redutores-torque-e-potencia/`);
    const redutor = await widget(page, 'section.redutor');
    await expect(redutor.locator('[data-saida]')).toContainText('13,7 N·m a 78,6 rpm');
    await expect(redutor.locator('[data-cremalheira]')).toContainText('455 N a 14,8 m/min');
    await redutor.getByRole('spinbutton', { name: 'Raio do pinhão (cm)' }).fill('6');
    await expect(redutor.locator('[data-cremalheira]')).toContainText('228 N a 29,6 m/min');
    errors.expectClean();
  });
});
