import { expect, test, type Page } from '@playwright/test';
import { expectAccessible, expectNoHorizontalOverflow, watchErrors } from './helpers';

const LESSONS = [
  'm00-comece-aqui/01-como-usar-este-curso/',
  'm00-comece-aqui/02-seguranca-em-eletricidade/',
  'm00-comece-aqui/03-ferramentas-essenciais/',
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
    test(`module 0 lessons have no serious violations (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      for (const path of LESSONS) {
        await test.step(path, async () => {
          await page.goto(path);
          await scrollThrough(page);
          await expectAccessible(page);
        });
      }
    });
  }
});

test('the shock calculator recomputes the current through the body', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(LESSONS[1]!);
  const calculator = page.getByRole('region', { name: 'Calculadora do choque' });
  await calculator.scrollIntoViewIfNeeded();
  const current = calculator.locator('.lw__value');
  await expect(current).toHaveText('1,26 mA');
  await calculator.locator('label', { hasText: 'Mão molhada' }).click();
  await expect(current).toHaveText('79,4 mA');
  await expect(calculator.locator('strong', { hasText: 'Perigo de morte' })).toBeVisible();
  errors.expectClean();
});

test('the multimeter dial explains each position', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(LESSONS[2]!);
  const meter = page.getByRole('region', { name: 'O seletor do multímetro' });
  await meter.scrollIntoViewIfNeeded();
  const name = meter.locator('.mmi__name');
  await expect(name).toHaveText('Tensão contínua (CC)');
  await meter.locator('label', { hasText: 'Corrente pequena' }).click();
  await expect(name).toHaveText('Corrente pequena');
  await expect(meter.getByText('Em série: o circuito é aberto')).toBeVisible();
  await expect(meter.getByText(/Nunca encoste as pontas numa tomada/)).toBeVisible();
  errors.expectClean();
});
