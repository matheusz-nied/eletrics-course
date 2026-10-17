import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { EXAMPLE_LESSON, watchErrors } from './helpers';

const LESSON_KEY = 'curso:v1:aula:m00-comece-aqui/00-exemplo';

test.describe('progress page', () => {
  test('starts empty and points to the first module', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('progresso/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Meu progresso');
    await expect(page.locator('[data-empty]')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Módulo 0: Comece aqui' })).toBeVisible();
    await expect(page.locator('[data-quiz-empty]')).toBeVisible();
    errors.expectClean();
  });

  test('exports, clears and imports the progress', async ({ page }, testInfo) => {
    const errors = watchErrors(page);
    // Some progress: a concluded lesson and a workshop step.
    await page.goto(EXAMPLE_LESSON);
    await page.getByRole('button', { name: 'Concluí esta aula' }).click();
    await page
      .locator('#oficina-exemplo')
      .getByLabel(/Passo 1 feito/)
      .check();
    await page.evaluate(() => localStorage.setItem('curso:v1:tema', 'escuro'));

    await page.goto('progresso/');
    await expect(page.locator('[data-empty]')).toBeHidden();
    const workshops = page.locator('[data-workshop-list]');
    await expect(workshops).toContainText('Testar uma pilha com o multímetro');
    await expect(workshops).toContainText('1 de 5 passos feitos');
    await expect(page.locator('[data-stat="oficinas"]')).toHaveText('1');

    // Export
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Baixar arquivo do progresso' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(
      /^progresso-curso-eletronica-\d{4}-\d{2}-\d{2}\.json$/,
    );
    const path = testInfo.outputPath('progresso.json');
    await file.saveAs(path);
    const exported = JSON.parse(await readFile(path, 'utf8'));
    expect(exported).toMatchObject({ formato: 'curso-eletronica/progresso', versao: 1 });
    expect(Object.keys(exported.dados)).toEqual(
      expect.arrayContaining([LESSON_KEY, 'curso:v1:oficina:exemplo']),
    );

    // Clear, with a confirmation; the theme stays.
    const clear = page.getByRole('button', { name: 'Apagar meu progresso' });
    await clear.click();
    await page.getByRole('button', { name: 'Confirmar: apagar tudo' }).click();
    await expect(page.locator('[data-message]')).toHaveText('Progresso apagado.');
    await expect(page.locator('[data-empty]')).toBeVisible();
    expect(await page.evaluate((k) => localStorage.getItem(k), LESSON_KEY)).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem('curso:v1:tema'))).toBe('escuro');

    // A file that is not a progress export is refused.
    await page.getByLabel('Arquivo exportado (.json)').setInputFiles({
      name: 'outro.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"nada": true}'),
    });
    await page.getByRole('button', { name: 'Importar' }).click();
    await expect(page.locator('[data-message]')).toHaveText(
      'Este arquivo não é um progresso exportado por este curso.',
    );

    // Import the exported file back.
    await page.getByLabel('Arquivo exportado (.json)').setInputFiles(path);
    await page.getByRole('button', { name: 'Importar' }).click();
    await expect(page.locator('[data-message]')).toContainText('Progresso importado');
    await expect(workshops).toContainText('1 de 5 passos feitos');
    expect(await page.evaluate((k) => localStorage.getItem(k), LESSON_KEY)).toContain('lida');
    errors.expectClean();
  });

  test('changes in another tab show up without reloading', async ({ page, context }) => {
    await page.goto('progresso/');
    await expect(page.locator('[data-empty]')).toBeVisible();
    const other = await context.newPage();
    await other.goto(EXAMPLE_LESSON);
    await other
      .locator('#oficina-exemplo')
      .getByLabel(/Passo 1 feito/)
      .check();
    await expect(page.locator('[data-workshop-list]')).toContainText('1 de 5 passos feitos');
    await other.close();
  });
});
