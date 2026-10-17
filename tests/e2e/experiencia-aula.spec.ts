import { expect, test, type Locator, type Page } from '@playwright/test';
import { EXAMPLE_LESSON, expectNoHorizontalOverflow, watchErrors } from './helpers';

const LESSON_ID = 'm00-comece-aqui/00-exemplo';

async function stored(page: Page, key: string): Promise<unknown> {
  const raw = await page.evaluate((k) => localStorage.getItem(k), key);
  return raw === null ? null : JSON.parse(raw);
}

/** The quiz island hydrates when it scrolls into view. */
async function openQuiz(page: Page): Promise<Locator> {
  const quiz = page.locator('[data-quiz]');
  await quiz.scrollIntoViewIfNeeded();
  await expect(page.locator('astro-island:has([data-quiz])')).not.toHaveAttribute('ssr');
  return quiz;
}

test.describe('lesson progress', () => {
  test('records the visit and marks the lesson as concluded', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(EXAMPLE_LESSON);
    const footer = page.getByRole('region', { name: 'Seu progresso', exact: true });
    const toggle = footer.getByRole('button', { name: 'Concluí esta aula' });
    await expect(toggle).toBeEnabled();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(await stored(page, `curso:v1:aula:${LESSON_ID}`)).toMatchObject({
      visitada: expect.any(String),
    });
    expect(await stored(page, 'curso:v1:ultima-aula')).toMatchObject({ id: LESSON_ID });

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(footer).toContainText('Você concluiu esta aula em');

    await page.reload();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(await stored(page, `curso:v1:aula:${LESSON_ID}`)).not.toHaveProperty('lida');
    errors.expectClean();
  });
});

test.describe('quiz', () => {
  test('checks each question, explains the answers and saves the score', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(EXAMPLE_LESSON);
    const quiz = await openQuiz(page);
    const questions = quiz.locator('.quiz__q');
    await expect(questions).toHaveCount(5);
    const check = (q: Locator) => q.getByRole('button', { name: 'Verificar' }).click();

    // 1. Number: "0,5" with a comma; text that is not a number is not graded.
    const q1 = questions.nth(0);
    await expect(q1.getByRole('button', { name: 'Verificar' })).toBeDisabled();
    await q1.getByLabel('Sua resposta').fill('meio');
    await check(q1);
    await expect(q1.getByRole('alert')).toContainText('Não entendi esse número');
    await q1.getByLabel('Sua resposta').fill('500 mA');
    await check(q1);
    await expect(q1).toContainText('Correto!');
    await expect(q1).toContainText('Resposta: 0,5 A');
    await expect(q1).toContainText('I = V/R = 127/254 = 0,5 A.');

    // 2. Multiple choice, wrong on purpose: the feedback of the chosen option shows.
    const q2 = questions.nth(1);
    await q2.getByLabel('Em série com o circuito').check();
    await check(q2);
    await expect(q2).toContainText('Não foi dessa vez.');
    await expect(q2).toContainText('Em série se liga o amperímetro.');
    await expect(q2.locator('[data-result="certa"]')).toContainText('Em paralelo');

    // 3. True or false.
    const q3 = questions.nth(2);
    await q3.getByLabel('Verdadeiro').check();
    await check(q3);
    await expect(q3).toContainText('Correto!');

    // 4. Put in order with the arrow buttons (keyboard and touch friendly).
    const q4 = questions.nth(3);
    const steps = ['Desligar o disjuntor', 'Testar a ausência de tensão', 'Mexer nos fios'];
    const texts = q4.locator('.quiz__order-text');
    await expect(texts).not.toHaveText(steps);
    for (const [target, item] of steps.entries()) {
      for (;;) {
        const current = (await texts.allTextContents()).indexOf(item);
        if (current <= target) break;
        await q4.getByRole('button', { name: `Subir: ${item}` }).click();
      }
    }
    await expect(texts).toHaveText(steps);
    await check(q4);
    await expect(q4).toContainText('Correto!');

    // 5. Matching.
    const q5 = questions.nth(4);
    await q5.getByLabel('Tensão').selectOption({ label: 'volt' });
    await q5.getByLabel('Corrente').selectOption({ label: 'ampère' });
    await check(q5);
    await expect(q5).toContainText('Correto!');

    await expect(quiz.locator('.quiz__score')).toHaveText('Você acertou 4 de 5.');
    const record = (await stored(page, `curso:v1:aula:${LESSON_ID}`)) as {
      quizzes: Record<string, { acertos: number; total: number }>;
    };
    expect(Object.values(record.quizzes)).toEqual([
      expect.objectContaining({ acertos: 4, total: 5, melhor: 4 }),
    ]);
    await expect(page.getByRole('region', { name: 'Seu progresso', exact: true })).toContainText(
      'Exercícios: 4 de 5 acertos',
    );

    // Doing it again starts over and remembers the last result.
    await quiz.getByRole('button', { name: 'Refazer os exercícios' }).click();
    await expect(quiz.getByRole('button', { name: 'Verificar' })).toHaveCount(5);
    await expect(quiz).toContainText('Da última vez você acertou 4 de 5.');
    await expect(questions.nth(0).getByLabel('Sua resposta')).toBeFocused();
    errors.expectClean();
  });

  test('ordering keeps the focus on the moved item', async ({ page }) => {
    await page.goto(EXAMPLE_LESSON);
    const quiz = await openQuiz(page);
    const q4 = quiz.locator('.quiz__q').nth(3);
    const first = (await q4.locator('.quiz__order-text').first().textContent()) ?? '';
    await q4.getByRole('button', { name: `Descer: ${first}` }).focus();
    await page.keyboard.press('Enter');
    await expect(q4.locator('.quiz__order-text').nth(1)).toHaveText(first);
    await expect(q4.locator('[aria-live]')).toHaveText(`${first}: posição 2 de 3.`);
    const focused = await page.evaluate(() => document.activeElement?.textContent);
    expect(focused).toContain(first);
  });
});

test.describe('glossary term', () => {
  test('opens the definition and links to the glossary', async ({ page }) => {
    await page.goto(EXAMPLE_LESSON);
    const term = page.locator('button[data-term="tensao"]');
    await term.click();
    const popover = page.locator('.term-pop:popover-open');
    await expect(popover).toBeVisible();
    await expect(popover).toContainText('Tensão elétrica');
    await expect(popover).toContainText('Diferença de potencial');
    await expect(term).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('Escape');
    await expect(popover).toHaveCount(0);
    await expect(term).toHaveAttribute('aria-expanded', 'false');

    await term.click();
    await page.getByRole('link', { name: 'Ver no glossário' }).click();
    await expect(page).toHaveURL(/glossario\/tensao\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tensão elétrica');
  });

  test('opens on mouse hover and stays open when clicked', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Hover is a mouse feature.');
    await page.goto(EXAMPLE_LESSON);
    const term = page.locator('button[data-term="tensao"]');
    await term.hover();
    const popover = page.locator('.term-pop:popover-open');
    await expect(popover).toBeVisible();
    await term.click();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(500);
    await expect(popover).toBeVisible();
  });
});

test.describe('workshop mode', () => {
  test('checklist, full-screen steps, resume and restart', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(EXAMPLE_LESSON);
    const workshop = page.locator('#oficina-exemplo');
    await expect(workshop).toHaveAttribute('data-ready', '');
    const count = workshop.locator('[data-workshop-count]');
    await expect(count).toHaveText('0 de 5 passos feitos');

    // List mode: tick the first step.
    await workshop.getByLabel(/Passo 1 feito/).check();
    await expect(count).toHaveText('1 de 5 passos feitos');
    await page.reload();
    await expect(workshop.getByLabel(/Passo 1 feito/)).toBeChecked();

    // Workshop mode opens where the student stopped.
    const open = workshop.getByRole('button', { name: 'Continuar do passo 2' });
    await open.click();
    const dialog = page.getByRole('dialog', { name: 'Testar uma pilha com o multímetro' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-workshop-position]')).toHaveText('Passo 2 de 5');
    await expect(page.locator(':focus')).toContainText('Gire o seletor para tensão contínua');
    await expect(page.locator('header.site-header')).toHaveAttribute('inert', '');

    await dialog.getByRole('button', { name: 'Feito' }).click();
    await expect(dialog.locator('[data-workshop-position]')).toHaveText('Passo 3 de 5');
    await page.keyboard.press('ArrowLeft');
    await expect(dialog.locator('[data-workshop-position]')).toHaveText('Passo 2 de 5');
    await expect(dialog.getByRole('button', { name: 'Feito' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.keyboard.press('ArrowRight');
    await expectNoHorizontalOverflow(page);

    // Escape leaves and returns the focus to the button that opened it.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.locator('header.site-header')).not.toHaveAttribute('inert', '');
    await expect(workshop.getByRole('button', { name: 'Continuar do passo 3' })).toBeFocused();
    await expect(count).toHaveText('2 de 5 passos feitos');
    expect(await stored(page, 'curso:v1:oficina:exemplo')).toMatchObject({
      feitos: ['encaixar-pontas', 'escolher-escala'],
      atual: 'medir-pilha',
    });

    // Restart asks to confirm.
    const reset = workshop.getByRole('button', { name: 'Recomeçar' });
    await reset.click();
    await workshop.getByRole('button', { name: 'Apagar os passos feitos?' }).click();
    await expect(count).toHaveText('0 de 5 passos feitos');
    await expect(workshop.getByRole('button', { name: 'Abrir modo oficina' })).toBeVisible();
    errors.expectClean();
  });

  test('the last step leads to the end screen and closes', async ({ page }) => {
    await page.goto(EXAMPLE_LESSON);
    const workshop = page.locator('#oficina-exemplo');
    await workshop.getByRole('button', { name: 'Abrir modo oficina' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('[data-workshop-position]')).toHaveText('Preparação');
    await dialog.getByRole('button', { name: 'Começar' }).click();
    for (let i = 1; i <= 5; i++) {
      await expect(dialog.locator('[data-workshop-position]')).toHaveText(`Passo ${i} de 5`);
      await dialog.getByRole('button', { name: 'Feito' }).click();
    }
    await expect(dialog).toContainText('Todos os passos feitos');
    await dialog.getByRole('button', { name: 'Concluir' }).click();
    await expect(dialog).toBeHidden();
    await expect(workshop.locator('[data-workshop-count]')).toHaveText('5 de 5 passos feitos');
  });
});
