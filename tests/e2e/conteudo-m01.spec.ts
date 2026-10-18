import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectAccessible, expectNoHorizontalOverflow, watchErrors } from './helpers';

const MODULE = 'm01-eletricidade-do-zero';
const LESSONS = [
  `${MODULE}/01-atomos-eletrons-e-carga/`,
  `${MODULE}/02-corrente-eletrica/`,
  `${MODULE}/03-tensao/`,
  `${MODULE}/04-lei-de-ohm/`,
  `${MODULE}/05-potencia-e-energia/`,
  `${MODULE}/06-unidades-e-ordens-de-grandeza/`,
];

/** Scrolls through the whole lesson so every `client:visible` island mounts. */
async function scrollThrough(page: Page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight / 2) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  });
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
}

/** Scrolls to a `client:visible` widget and waits until React has hydrated it. */
async function hydrated(page: Page, widget: Locator): Promise<Locator> {
  const island = page.locator('astro-island', { has: widget }).last();
  await island.scrollIntoViewIfNeeded();
  await expect(island).not.toHaveAttribute('ssr');
  return widget;
}

/** "12,4 W" or "1,23 kW" in watts. */
function watts(text: string): number {
  const match = /([\d.]+(?:,\d+)?)\s*(k?)W/.exec(text);
  if (!match) throw new Error(`no W reading in "${text}"`);
  return Number(match[1]!.replaceAll('.', '').replace(',', '.')) * (match[2] ? 1000 : 1);
}

for (const path of LESSONS) {
  test(`${path} opens, mounts its islands and does not scroll sideways`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(path);
    await scrollThrough(page);
    await expect(page.locator('.katex-error')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    errors.expectClean();
  });
}

test.describe('accessibility', () => {
  test.skip(({ isMobile }) => isMobile, 'Runs once, on desktop.');

  for (const theme of ['light', 'dark'] as const) {
    for (const path of LESSONS) {
      test(`${path} has no serious violations (${theme})`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: theme });
        await page.goto(path);
        await scrollThrough(page);
        await expectAccessible(page);
      });
    }
  }
});

test('the module page lists the six lessons in order', async ({ page }) => {
  await page.goto(`${MODULE}/`);
  const lessons = page.getByRole('region', { name: 'Aulas' }).getByRole('listitem');
  await expect(lessons).toHaveCount(6);
  await expect(lessons.first()).toContainText('Átomos');
  await expect(lessons.last()).toContainText('Unidades');
});

test('the shower challenges stay marked in both positions', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(LESSONS[4]!);
  const sim = page.locator('[data-simulation]').first();
  await sim.scrollIntoViewIfNeeded();
  await expect(sim).toHaveAttribute('data-ready', '');
  const goals = sim.getByRole('region', { name: 'Desafios' });
  const controls = sim.locator('.sim-controls');
  await expect(goals).toContainText('0/2');

  await controls.getByRole('switch', { name: 'Abrir a água' }).click();
  await expect(goals).toContainText('1/2');
  await controls.getByRole('switch', { name: 'Posição inverno' }).click();
  await expect(goals).toContainText('2/2');
  errors.expectClean();
});

test('the cord calculator shows less heat in a thicker cord', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(LESSONS[3]!);
  const calculator = await hydrated(
    page,
    page.getByRole('region', { name: 'Quanto esquenta a sua extensão' }),
  );
  const heat = calculator.locator('.lw__output .lw__value');
  const thin = watts(await heat.innerText());
  await calculator.locator('label', { hasText: '2,5 mm²' }).click();
  await expect.poll(async () => watts(await heat.innerText())).toBeLessThan(thin / 3);
  errors.expectClean();
});

test('the energy cost of a winter shower is about R$ 79 a month', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(LESSONS[4]!);
  const cost = await hydrated(page, page.getByRole('region', { name: 'Quanto custa por mês?' }));
  await expect(cost).toContainText('88 kWh');
  await expect(cost).toContainText('79,20');
  await cost.locator('label', { hasText: 'Chuveiro no verão' }).click();
  await expect(cost).toContainText('44 kWh');
  errors.expectClean();
});
