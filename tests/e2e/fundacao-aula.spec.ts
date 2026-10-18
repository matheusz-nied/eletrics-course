import { expect, test } from '@playwright/test';
import {
  EXAMPLE_LESSON,
  expectAccessible,
  expectNoHorizontalOverflow,
  watchErrors,
} from './helpers';

test.describe('example lesson', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(EXAMPLE_LESSON);
  });

  test('opens without errors and is marked as a draft', async ({ page }) => {
    const errors = watchErrors(page);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Aula de exemplo');
    await expect(page.getByText(/Rascunho: esta aula não aparece/)).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
    await expectNoHorizontalOverflow(page);
    errors.expectClean();
  });

  test('shows objectives, lesson facts and the automatic mains-safety notice', async ({ page }) => {
    const objectives = page.getByRole('region', { name: 'Nesta aula você vai' });
    await expect(objectives.getByRole('listitem')).toHaveCount(2);

    const facts = page.getByRole('list', { name: 'Sobre a aula' });
    await expect(facts).toContainText('Aula 0.0');
    await expect(facts).toContainText('Básico');
    await expect(facts).toContainText('5 min');
    await expect(facts).toContainText('Rede elétrica');

    // `seguranca: rede` adds the notice before the lesson text, with the standard rules.
    const notice = page.getByRole('note', { name: 'Segurança na rede elétrica' });
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('Desligue o disjuntor');
    await expect(notice).toContainText('Teste a ausência de tensão');
    await expect(notice).toContainText('Sinalize o quadro');
    await expect(notice).toContainText('Nunca trabalhe sozinho');
    await expect(notice).toContainText('chame um eletricista habilitado');
  });

  test('renders formulas with KaTeX at build time', async ({ page }) => {
    await expect(page.locator('.katex').first()).toBeVisible();
    await expect(page.locator('.katex-error')).toHaveCount(0);
    // The stylesheet matches the renderer's version, so formulas never wrap mid-symbol.
    await expect(page.locator('.katex-html > *').first()).toHaveCSS('white-space', 'nowrap');

    // Display formulas can scroll sideways, so each one takes keyboard focus.
    const formulas = page.locator('.katex-display');
    await expect(formulas).toHaveCount(2);
    for (const formula of await formulas.all()) {
      await expect(formula).toHaveRole('group');
      await expect(formula).toHaveAccessibleName('Fórmula');
      await expect(formula).toHaveAttribute('tabindex', '0');
    }
  });

  test('renders the content components', async ({ page }) => {
    for (const name of [
      'Nota',
      'Dica de bancada',
      'Atenção',
      'Perigo',
      'Antes de abrir a central do portão',
    ]) {
      await expect(page.getByRole('note', { name, exact: true })).toBeVisible();
    }

    const figure = page.getByRole('figure', { name: /^Figura 1\./ });
    await expect(figure).toContainText('Figura 1.');
    await expect(
      figure.getByRole('img', { name: /bateria de 12 volts ligada a um resistor/ }),
    ).toBeVisible();

    const steps = page.locator('ol.steps > li');
    await expect(steps).toHaveCount(3);
    await expect(steps.first()).toContainText('Desligue o disjuntor');

    const deepDive = page.locator('details', { hasText: 'De onde vem a Lei de Ohm' });
    await expect(deepDive).not.toHaveAttribute('open');
    await deepDive.locator('summary').click();
    await expect(deepDive).toHaveAttribute('open', '');
    await expect(deepDive.locator('.katex').first()).toBeVisible();

    await expect(
      page.getByRole('note', { name: 'Na prática: A extensão que esquenta' }),
    ).toBeVisible();
    await expect(page.locator('[data-term="tensao"]')).toHaveText('tensão');

    // Markdown tables scroll sideways inside their own box.
    await expect(page.locator('.table-wrap > table')).toHaveCount(1);
  });

  test('shows placeholders for the interactive components still in construction', async ({
    page,
  }) => {
    for (const stub of ['Model3D', 'Scene3D', 'WiringExercise']) {
      const box = page.locator(`[data-stub="${stub}"]`);
      await expect(box, stub).toHaveCount(1);
      await expect(box, stub).toContainText('em construção');
    }
  });

  test('table of contents links to the sections', async ({ page, isMobile }) => {
    if (isMobile) await page.getByRole('button', { name: 'Sumário' }).click();
    const toc = page.getByRole('navigation', { name: 'Nesta aula' });
    await expect(toc.getByRole('link')).toHaveText([
      'Texto e fórmulas',
      'Listas',
      'Avisos',
      'Figura',
      'Passo a passo',
      'Componentes interativos',
    ]);
    await toc.getByRole('link', { name: 'Passo a passo' }).click();
    await expect(page).toHaveURL(/#passo-a-passo$/);
    await expect(page.getByRole('heading', { level: 2, name: 'Passo a passo' })).toBeInViewport();
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test('the table of contents opens as a panel and closes with Escape', async ({ page }) => {
    await page.goto(EXAMPLE_LESSON);
    const sidebar = page.locator('#sumario');
    const toggle = page.getByRole('button', { name: 'Sumário' });
    await expect(sidebar).toBeHidden();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /Aula de exemplo/ })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await page.keyboard.press('Escape');
    await expect(sidebar).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeFocused();
  });

  test('formulas and tables wider than the screen scroll with the keyboard', async ({ page }) => {
    await page.goto(EXAMPLE_LESSON);
    const formula = page.locator('.katex-display').filter({ hasText: 'mW' });
    expect(await formula.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
      true,
    );

    await formula.focus();
    await expect(formula).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => formula.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);

    const table = page.getByRole('group', { name: 'Tabela' }).first();
    await expect(table).toHaveAttribute('tabindex', '0');

    // axe `scrollable-region-focusable`: every sideways-scrolling block takes focus.
    await expectAccessible(page);
  });

  for (const path of ['', 'm00-comece-aqui/', EXAMPLE_LESSON]) {
    test(`fits 360 px without sideways scrolling: /${path}`, async ({ page }) => {
      await page.goto(path);
      await expectNoHorizontalOverflow(page);
    });
  }
});
