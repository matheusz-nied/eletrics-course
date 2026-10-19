import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectAccessible, expectNoHorizontalOverflow, watchErrors } from './helpers';

const MODULE = 'm07-instalacoes/';

const LESSONS = ['02-fase-neutro-e-terra', '03-disjuntores-dr-e-dps'];

const HYDRATION = { timeout: 20_000 };

const PREFIX: Record<string, number> = { µ: 1e-6, m: 1e-3, '': 1, k: 1e3 };

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

/** The simulation `id`, scrolled into view, ready and running. */
async function running(page: Page, id: string): Promise<Locator> {
  const sim = page.locator(`[data-simulation="${id}"]`);
  await sim.scrollIntoViewIfNeeded();
  await expect(sim).toHaveAttribute('data-ready', '', HYDRATION);
  await sim.getByRole('button', { name: 'Iniciar simulação', exact: true }).click();
  return sim;
}

/** Number in base units of the multimeter on probe `id` (0 when it shows no reading). */
async function meter(sim: Locator, id: string, unit: string): Promise<number> {
  const text = await sim.locator(`.dmm[data-probe="${id}"] [data-reading]`).innerText();
  const match = new RegExp(`(−|-)?([\\d.]+(?:,\\d+)?)\\s*([µmk]?)${unit}`).exec(text);
  if (!match) return 0;
  const value = Number(match[2]!.replaceAll('.', '').replace(',', '.'));
  return (match[1] ? -1 : 1) * value * PREFIX[match[3] ?? '']!;
}

function controls(sim: Locator) {
  return sim.locator('.sim-controls');
}

test.describe('módulo 7: fase, neutro, terra e proteções', () => {
  for (const slug of LESSONS) {
    test(`lesson ${slug} loads its simulation and figures without errors`, async ({ page }) => {
      test.setTimeout(90_000);
      const errors = watchErrors(page);
      await page.goto(`${MODULE}${slug}/`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator('figure [role="img"], figure svg').first()).toBeVisible();
      await hydrateAll(page);
      await expectNoHorizontalOverflow(page);
      await expectAccessible(page);
      errors.expectClean();
    });
  }

  test('in a TT house the earthed case of lesson 7.2 still reaches about 93 V', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const errors = watchErrors(page);
    await page.goto(`${MODULE}02-fase-neutro-e-terra/`);
    const sim = await running(page, 'm07/maquina-de-lavar');
    const panel = controls(sim);
    await panel
      .getByRole('combobox', { name: /Esquema de aterramento/ })
      .selectOption({ label: 'TT: terra só na haste da casa' });
    await panel.getByRole('switch', { name: /Carcaça ligada ao terra/ }).click();
    await panel
      .getByRole('combobox', { name: /Falha de isolação/ })
      .selectOption({ label: 'Fio da fase encostado na carcaça' });
    await expect.poll(() => meter(sim, 'VC', 'V'), { timeout: 15_000 }).toBeGreaterThan(90);
    expect(await meter(sim, 'VC', 'V')).toBeLessThan(96);
    const breaker = await meter(sim, 'IDJ', 'A');
    expect(breaker).toBeGreaterThan(6.5);
    expect(breaker).toBeLessThan(7.5);
    await expect(sim.getByRole('region', { name: 'Desafios' })).toContainText(
      /No esquema TT[^]*\(cumprido\)/,
    );
    errors.expectClean();
  });

  test('a short circuit in lesson 7.3 trips the breaker at once', async ({ page }) => {
    test.setTimeout(60_000);
    const errors = watchErrors(page);
    await page.goto(`${MODULE}03-disjuntores-dr-e-dps/`);
    const sim = await running(page, 'm07/tres-falhas');
    const panel = controls(sim);
    await expect.poll(() => meter(sim, 'IDJ', 'A'), { timeout: 15_000 }).toBeGreaterThan(2);
    await panel.getByRole('switch', { name: /Curto-circuito/ }).click();
    await expect(panel.getByRole('switch', { name: 'Disjuntor ligado' })).not.toBeChecked({
      timeout: 15_000,
    });
    await expect.poll(() => meter(sim, 'IDJ', 'A'), { timeout: 15_000 }).toBeLessThan(0.01);
    errors.expectClean();
  });
});
