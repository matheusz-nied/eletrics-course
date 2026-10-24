import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectAccessible, expectNoHorizontalOverflow, watchErrors } from './helpers';

const MODULE = 'm12-microcontroladores/';

const LESSONS = [
  '01-o-que-e-um-microcontrolador',
  '02-maquinas-de-estado',
  '03-sensores',
  '04-atuadores',
  '05-programando-um-microcontrolador',
  '06-automacao-residencial',
];

/** Scrolls through the page so every island hydrates, and waits for the simulations. */
async function hydrateAll(page: Page) {
  for (const island of await page.locator('astro-island').all()) {
    await island.scrollIntoViewIfNeeded();
    // A 3D model above an island keeps the main thread busy while it loads.
    await expect(island).not.toHaveAttribute('ssr', { timeout: 30_000 });
  }
  for (const sim of await page.locator('[data-simulation]').all()) {
    await expect(sim).toHaveAttribute('data-ready', '', { timeout: 30_000 });
  }
}

/** The simulation `id`, scrolled into view and ready. */
async function simulation(page: Page, id: string) {
  const sim = page.locator(`[data-simulation="${id}"]`);
  await sim.scrollIntoViewIfNeeded();
  await expect(sim).toHaveAttribute('data-ready', '', { timeout: 30_000 });
  return sim;
}

/** The hydrated lesson widget whose root has `selector`. */
async function widget(page: Page, selector: string) {
  const island = page.locator(`astro-island:has(${selector})`).first();
  await island.scrollIntoViewIfNeeded();
  await expect(island).not.toHaveAttribute('ssr', { timeout: 30_000 });
  return island.locator(selector);
}

/** The reading of the multimeter on probe `id`. */
function reading(sim: Locator, id: string) {
  return sim.locator(`.dmm[data-probe="${id}"] [data-reading]`);
}

/** Holds a momentary control down for `ms`. */
async function tap(page: Page, button: Locator, ms = 200) {
  await button.hover();
  await page.mouse.down();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

test.describe('módulo 12: microcontroladores', () => {
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

  test('the button of lesson 12.4 toggles the relay and the lamp', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    await page.goto(`${MODULE}04-atuadores/`);
    const sim = await simulation(page, 'm12/rele-lampada');
    await sim.getByRole('button', { name: 'Iniciar simulação', exact: true }).click();
    const button = sim.locator('.sim-controls').getByRole('button', { name: /^Botão \(D2\)/ });
    await tap(page, button);
    await expect(reading(sim, 'IK')).toContainText(/30,\d\smA/, { timeout: 15_000 });
    await expect(reading(sim, 'IL')).toContainText(/41\d\smA/, { timeout: 15_000 });
    await tap(page, button);
    await expect(reading(sim, 'IL')).toContainText(/:\s-?0\sA|:\s-?\d+(,\d+)?\s[nµp]A/, {
      timeout: 15_000,
    });
    errors.expectClean();
  });

  test('the wall switch of lesson 12.6 toggles the lamp in either position', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    await page.goto(`${MODULE}06-automacao-residencial/`);
    const sim = await simulation(page, 'm12/rele-inteligente');
    await sim.getByRole('button', { name: 'Iniciar simulação', exact: true }).click();
    const sw = sim.locator('.sim-controls').getByRole('switch', { name: /Interruptor da parede/ });
    await sw.click();
    await expect(reading(sim, 'VL')).toContainText(/:\s127\sV/, { timeout: 15_000 });
    await sw.click();
    await expect(reading(sim, 'VL')).not.toContainText(/:\s127\sV/, { timeout: 15_000 });
    errors.expectClean();
  });

  test('the board of lesson 12.5 runs the blink program and reports a missing semicolon', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}05-programando-um-microcontrolador/`);
    const ide = await widget(page, '.mide');
    await ide.getByRole('button', { name: 'Enviar para a placa' }).click();
    await expect(ide).toHaveAttribute('data-estado', 'rodando');
    await expect(ide).toHaveAttribute('data-led13', 'on', { timeout: 5_000 });
    await expect(ide).toHaveAttribute('data-led13', 'off', { timeout: 5_000 });
    const code = ide.locator('.mide__textarea');
    await code.fill((await code.inputValue()).replace('delay(1000);', 'delay(1000)'));
    await ide.getByRole('button', { name: 'Enviar para a placa' }).click();
    await expect(ide.locator('.mide__status')).toContainText('ponto e vírgula');
    errors.expectClean();
  });

  test('the live state diagram of lesson 12.2 opens the gate on a command', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}02-maquinas-de-estado/`);
    const med = await widget(page, '.med');
    await expect(med).toHaveAttribute('data-estado', 'FECHADO');
    await med.getByRole('button', { name: 'Apertar o controle' }).click();
    await expect(med).toHaveAttribute('data-estado', 'ABRINDO', { timeout: 5_000 });
    await expect(med.locator('.med__log li').first()).toContainText('FECHADO → ABRINDO');
    errors.expectClean();
  });

  test('the ultrasound tab of lesson 12.3 times the echo at 1 m', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}03-sensores/`);
    const lab = await widget(page, '.labsens');
    await lab.getByRole('tab', { name: 'Distância (ultrassom)' }).click();
    await expect(lab.locator('[data-sensor]')).toHaveAttribute('data-sensor', 'ultrassom');
    await expect(lab.locator('[data-leitura="largura"]')).toContainText('5.824');
    errors.expectClean();
  });

  test('the wall switch of lesson 12.6 still works when the internet is down', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}06-automacao-residencial/`);
    const caminho = await widget(page, '.caminho');
    await caminho.getByRole('checkbox', { name: 'Internet caiu' }).check();
    await caminho.getByRole('button', { name: 'Acender pelo app' }).click();
    await expect(caminho.locator('.caminho__status')).toContainText('não chega', {
      timeout: 15_000,
    });
    await expect(caminho).toHaveAttribute('data-lampada', 'apagada');
    await caminho.getByRole('button', { name: 'Apertar o interruptor' }).click();
    await expect(caminho).toHaveAttribute('data-lampada', 'acesa', { timeout: 15_000 });
    errors.expectClean();
  });
});
