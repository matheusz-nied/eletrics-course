import { expect, test } from '@playwright/test';
import { expectAccessible, expectNoHorizontalOverflow, watchErrors } from './helpers';

/** The course experience pages (home, catalog, tracks, glossary, search, progress, offline). */
const PAGES = [
  '',
  'modulos/',
  'trilhas/',
  'trilhas/portao-eletronico/',
  'glossario/',
  'glossario/tensao/',
  'busca/',
  'progresso/',
  'offline/',
];

test('home shows the tracks, the modules and the reference case', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('eletricidade');

  const tracks = page.locator('#trilhas');
  for (const name of [
    'Portão eletrônico',
    'Eletricista residencial',
    'Eletrônica maker',
    'Curso completo',
  ]) {
    await expect(tracks.getByRole('heading', { name, exact: true })).toBeVisible();
  }

  const modules = page.locator('#modulos');
  await expect(modules.getByRole('heading', { level: 2, name: 'Módulos' })).toBeVisible();
  // The whole curriculum is shown, published or not: modules 0 to 17.
  await expect(modules.getByRole('heading', { level: 4 })).toHaveCount(18);

  // Nothing studied yet: no "continuar".
  await expect(page.locator('[data-resume]')).toBeHidden();
  errors.expectClean();
});

test('module catalog lists every planned lesson', async ({ page }) => {
  await page.goto('modulos/');
  const modules = page.locator('details');
  await expect(modules).toHaveCount(18);
  const gate = page.locator('details#m16-portao');
  await gate.locator('summary').click();
  await expect(gate).toHaveAttribute('open', '');
  await expect(gate.getByText('Em breve').first()).toBeVisible();

  // A link to a module opens its row.
  await page.goto('modulos/#m08-motores');
  await expect(page.locator('details#m08-motores')).toHaveAttribute('open', '');
});

test('track page shows who it is for and the steps of the track', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('trilhas/');
  await page
    .getByRole('link', { name: /Portão eletrônico/ })
    .first()
    .click();
  await expect(page).toHaveURL(/trilhas\/portao-eletronico\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Portão eletrônico/);
  await expect(page.getByText('Para quem:')).toBeVisible();
  for (const name of ['Comece aqui', 'Projeto real: automatizador de portão']) {
    await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
  }
  errors.expectClean();
});

for (const theme of ['light', 'dark'] as const) {
  test(`course pages have no serious accessibility violations (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    for (const path of PAGES) {
      await test.step(path || 'início', async () => {
        await page.goto(path);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expectAccessible(page);
      });
    }
  });
}

test.describe('on a phone', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  for (const path of PAGES) {
    test(`fits 360 px without sideways scrolling: /${path}`, async ({ page }) => {
      await page.goto(path);
      await expectNoHorizontalOverflow(page);
    });
  }

  test('the menu opens with the site links and closes with Escape', async ({ page }) => {
    await page.goto('');
    const button = page.getByRole('button', { name: 'Menu', exact: true });
    await button.click();
    const menu = page.getByRole('dialog', { name: 'Menu' });
    await expect(menu).toBeVisible();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    for (const name of ['Início', 'Módulos', 'Trilhas', 'Glossário', 'Busca', 'Meu progresso']) {
      await expect(menu.getByRole('link', { name, exact: true })).toBeVisible();
    }
    await expect(menu.getByRole('link', { name: 'Início' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
  });
});
