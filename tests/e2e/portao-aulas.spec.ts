import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectAccessible, expectNoHorizontalOverflow, watchErrors } from './helpers';

/** The lessons of module 16 (the gate), in order. */
const LESSONS = [
  '01-anatomia-do-automatizador',
  '02-o-motor-do-portao',
  '03-a-central-por-dentro',
  '04-fim-de-curso-e-sensores',
  '05-seguranca-e-acessorios',
  '06-controle-remoto-e-receptor',
  '07-trocar-motor-e-central',
  '08-ajustes-e-testes',
  '09-diagnostico-do-portao',
  '10-do-generico-para-a-sua-central',
];

const lesson = (slug: string) => `m16-portao/${slug}/`;

/** Scrolls every island into view and waits until it has hydrated. */
async function hydrateAll(page: Page) {
  const islands = page.locator('astro-island');
  const count = await islands.count();
  for (let i = 0; i < count; i++) {
    const island = islands.nth(i);
    await island.scrollIntoViewIfNeeded();
    await expect(island).not.toHaveAttribute('ssr');
  }
}

/** The island that holds `selector`, scrolled into view and hydrated. */
async function island(page: Page, selector: string): Promise<Locator> {
  const widget = page.locator(selector).first();
  await widget.scrollIntoViewIfNeeded();
  await expect(page.locator(`astro-island:has(${selector})`).first()).not.toHaveAttribute('ssr');
  return widget;
}

test.describe('gate module', () => {
  test('the module page lists the ten lessons in order', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('m16-portao/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Projeto real: automatizador de portão',
    );
    const hrefs = await page
      .locator('main a[href*="/m16-portao/"]')
      .evaluateAll((links) => links.map((a) => new URL((a as HTMLAnchorElement).href).pathname));
    const order = LESSONS.map((slug) => hrefs.findIndex((h) => h.endsWith(`/${lesson(slug)}`)));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    errors.expectClean();
  });

  for (const slug of LESSONS) {
    test(`opens, hydrates and fits the screen: ${slug}`, async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto(lesson(slug));
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator('[data-quiz]')).toHaveCount(1);
      await hydrateAll(page);
      await expectNoHorizontalOverflow(page);
      errors.expectClean();
    });
  }
});

test.describe('accessibility', () => {
  test.skip(({ isMobile }) => isMobile, 'Checked once, on desktop.');

  for (const theme of ['light', 'dark'] as const) {
    test(`no serious violations in the gate lessons (${theme})`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.emulateMedia({ colorScheme: theme });
      for (const slug of LESSONS) {
        await test.step(slug, async () => {
          await page.goto(lesson(slug));
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
          await hydrateAll(page);
          await expectAccessible(page);
        });
      }
    });
  }
});

test.describe('central virtual', () => {
  test('the remote opens the gate and the state shows it', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(lesson('01-anatomia-do-automatizador'));
    const central = await island(page, '[data-central-virtual]');
    const state = central.locator('.cv-state');
    await expect(state).toContainText('Fechado');
    await central.getByRole('button', { name: 'Controle remoto' }).click();
    await expect(state).toContainText('Abrindo');
    errors.expectClean();
  });
});

test.describe('finding the common wire', () => {
  test('the three readings point to the common wire', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(lesson('02-o-motor-do-portao'));
    const exercise = await island(page, '[data-medir-fios]');
    const red = exercise.getByRole('group', { name: 'Ponta vermelha' });
    const black = exercise.getByRole('group', { name: 'Ponta preta' });
    const meter = exercise.locator('.mf-meter__value');
    await expect(meter).toHaveText('OL');

    const readings: number[] = [];
    for (const [a, b] of [
      [1, 2],
      [1, 3],
      [2, 3],
    ]) {
      await red.getByLabel(new RegExp(`^Fio ${a} `)).check();
      await black.getByLabel(new RegExp(`^Fio ${b} `)).check();
      await expect(meter).toHaveText(/^\d+,\d Ω$/);
      readings.push(Number((await meter.innerText()).replace(' Ω', '').replace(',', '.')));
    }
    // The largest reading is the two windings in series; the wire left out is the common.
    const common = [3, 2, 1][readings.indexOf(Math.max(...readings))];
    const guess = exercise.getByRole('group', { name: 'Qual fio é o comum?' });
    await guess.getByLabel(new RegExp(`^Fio ${common} `)).check();
    await guess.getByRole('button', { name: 'Verificar' }).click();
    await expect(exercise.getByRole('status')).toContainText(`Certo: o fio ${common} é o comum`);
    errors.expectClean();
  });
});

test.describe('gate diagnosis', () => {
  test('the blown fuse: measured with the breaker off, then the cause is checked', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto(lesson('09-diagnostico-do-portao'));
    const exercise = await island(page, '[data-diagnostico]');
    await expect(exercise.getByRole('heading', { name: 'Caso 1 de 8' })).toBeVisible();
    const readings = exercise.locator('.dg-resultados');

    await exercise.getByRole('button', { name: 'Tensão entre F e N' }).click();
    await expect(readings).toContainText('127 V entre F e N');
    // Continuity is refused while the breaker is on.
    const fuse = exercise.getByRole('button', { name: 'Continuidade do fusível' });
    await fuse.click();
    await expect(readings).toContainText('Desligue o disjuntor');
    await exercise.getByLabel('Disjuntor do portão ligado').uncheck();
    await fuse.click();
    await expect(readings).toContainText('OL, sem bipe');

    await exercise.getByLabel('Fusível da central queimado').check();
    await exercise.getByRole('button', { name: 'Conferir' }).click();
    await expect(exercise.locator('.dg-feedback')).toContainText('Certo.');
    await expect(exercise.locator('.dg-score')).toContainText('Resolvidos: 1 de 8');
    errors.expectClean();
  });
});

test.describe('workshop: swapping the gate motor', () => {
  test('opens in workshop mode with the safety preparation first', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(lesson('07-trocar-motor-e-central'));
    const workshop = page.locator('#oficina-trocar-motor-portao');
    await expect(workshop).toHaveAttribute('data-ready', '');
    await workshop.getByRole('button', { name: 'Abrir modo oficina' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('[data-workshop-position]')).toHaveText('Preparação');
    await dialog.getByRole('button', { name: 'Começar' }).click();
    await expect(dialog.locator('[data-workshop-position]')).toHaveText(/^Passo 1 de \d+$/);
    await expectNoHorizontalOverflow(page);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    errors.expectClean();
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  for (const slug of LESSONS) {
    test(`fits 360 px without sideways scrolling: ${slug}`, async ({ page }) => {
      await page.goto(lesson(slug));
      await hydrateAll(page);
      await expectNoHorizontalOverflow(page);
    });
  }
});
