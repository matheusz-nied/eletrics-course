import { expect, test } from '@playwright/test';
import { watchErrors } from './helpers';

test.describe('search', () => {
  test('search page finds glossary terms, with accents or without', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('busca/');
    const input = page.getByRole('searchbox', { name: 'Buscar no curso' });
    await expect(input).toBeFocused();
    await input.fill('tensao');
    const results = page.getByRole('list', { name: 'Resultados' });
    await expect(results.getByRole('link', { name: /Tensão elétrica/ })).toBeVisible();
    const status = page.locator('main [data-search-status]');
    await expect(status).toContainText('para "tensao"');
    await expect(page).toHaveURL(/busca\/\?q=tensao$/);

    // The type filter is a radio group.
    await page.getByRole('radio', { name: 'Aulas' }).click();
    await expect(page.getByRole('radio', { name: 'Aulas' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.getByRole('radio', { name: 'Glossário' }).click();
    await expect(results.getByRole('link', { name: /Tensão elétrica/ })).toBeVisible();

    await input.fill('xyzwq');
    await expect(status).toContainText('Nada encontrado');
    errors.expectClean();
  });

  test('a link with ?q= opens with the results', async ({ page }) => {
    await page.goto('busca/?q=disjuntor');
    await expect(page.getByRole('searchbox', { name: 'Buscar no curso' })).toHaveValue('disjuntor');
    await expect(page.getByRole('link', { name: /Disjuntor/ }).first()).toBeVisible();
  });

  test('Ctrl+K opens the quick search from any page', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('modulos/');
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: 'Buscar no curso' });
    await expect(dialog).toBeVisible();
    const input = dialog.getByRole('searchbox');
    await expect(input).toBeFocused();
    await input.fill('capacitor');
    const hit = dialog.getByRole('link', { name: /Capacitor/ }).first();
    await expect(hit).toBeVisible();
    const href = await hit.getAttribute('href');
    await page.keyboard.press('ArrowDown');
    await expect(hit).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new URL(href!, page.url()).href);
    errors.expectClean();
  });

  test('the header search button and "/" open the same dialog', async ({ page }) => {
    await page.goto('');
    await page.getByRole('link', { name: 'Buscar', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Buscar no curso' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await page.locator('body').press('/');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Fechar a busca' }).click();
    await expect(dialog).toBeHidden();
  });
});

test.describe('glossary', () => {
  test('filters by name or synonym and links each term', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('glossario/');
    await expect(page.locator('[data-gloss-count]')).toHaveText(/^\d+ termos$/);
    const filter = page.getByRole('searchbox', { name: 'Filtrar termos' });
    await filter.fill('ddp');
    await expect(page.locator('[data-gloss-count]')).toHaveText('1 termo');
    await page.getByRole('link', { name: /Tensão elétrica/ }).click();
    await expect(page).toHaveURL(/glossario\/tensao\/$/);
    await expect(page.getByText('voltagem', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /Corrente elétrica/ })).toBeVisible();
    errors.expectClean();
  });
});
