import { expect, test } from '@playwright/test';
import { expectAccessible, expectNoHorizontalOverflow, watchErrors } from './helpers';

const PAGE = 'dev/motor/';

test('the engine page lists the device catalog without errors', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(PAGE);
  await expect(page.getByRole('heading', { level: 1, name: 'Motor de simulação' })).toBeVisible();
  for (const type of ['resistor', 'lamp', 'fuse', 'switch-spdt', 'potentiometer']) {
    await expect(page.locator(`#tipo-${type}`)).toBeVisible();
  }
  await expectAccessible(page);
  await expectNoHorizontalOverflow(page);
  errors.expectClean();
});

test('a circuit runs in the Web Worker and reacts to a switch', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(PAGE);
  const time = page.locator('[data-readout="t"]');
  const brightness = page.locator('[data-readout="L1.brightness"]');
  const button = page.getByRole('button', { name: 'Ligar a chave' });
  await expect(button).toBeEnabled();
  await expect(time).not.toHaveText('—');
  await expect(brightness).toHaveText('0');
  await button.click();
  await expect(page.getByRole('button', { name: 'Desligar a chave' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  // The filament heats in a fraction of a second: brightness close to 1.
  await expect(brightness).toHaveText(/^(0,9\d*|1(,\d+)?)$/, { timeout: 5000 });
  errors.expectClean();
});

test('50 nodes run above 1.000 steps/s at 60 frames/s with the CPU 4× slower', async ({ page }) => {
  test.slow();
  const errors = watchErrors(page);
  await page.goto(PAGE);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.getByRole('button', { name: 'Medir desempenho' }).click();
  const result = page.locator('#resultado');
  await expect(result).toHaveAttribute('data-raw', /\d+/, { timeout: 30_000 });
  const raw = Number(await result.getAttribute('data-raw'));
  const worker = Number(await result.getAttribute('data-worker'));
  const fps = Number(await result.getAttribute('data-fps'));
  test.info().annotations.push({
    type: 'desempenho',
    description: `página ${raw} passos/s; worker ${worker} passos/s a ${fps} quadros/s`,
  });
  expect(raw).toBeGreaterThan(1000);
  expect(worker).toBeGreaterThan(1000);
  expect(fps).toBeGreaterThan(50);
  errors.expectClean();
});
