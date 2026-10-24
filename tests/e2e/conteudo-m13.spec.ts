import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectAccessible, expectNoHorizontalOverflow, watchErrors } from './helpers';

const MODULE = 'm13-sem-fio/';

const LESSONS = [
  '01-ondas-eletromagneticas',
  '02-antenas',
  '03-controles-remotos',
  '04-infravermelho-bluetooth-e-wifi',
];

/** Islands behind a 3D model take a while to hydrate on a loaded runner (software WebGL). */
const HYDRATION = { timeout: 30_000 };

/** Scrolls through the page so every island hydrates, and waits for the simulations. */
async function hydrateAll(page: Page) {
  for (const island of await page.locator('astro-island').all()) {
    await island.scrollIntoViewIfNeeded();
    await expect(island).not.toHaveAttribute('ssr', HYDRATION);
  }
  for (const sim of await page.locator('[data-simulation]').all()) {
    await expect(sim).toHaveAttribute('data-ready', '', HYDRATION);
  }
}

/** The hydrated lesson widget whose root has `selector`. */
async function widget(page: Page, selector: string): Promise<Locator> {
  const island = page.locator(`astro-island:has(${selector})`).first();
  await island.scrollIntoViewIfNeeded();
  await expect(island).not.toHaveAttribute('ssr', HYDRATION);
  return island.locator(selector);
}

/** Picks the radio choice labelled `name`; the styled label sits over the input. */
async function choose(root: Locator, name: string | RegExp) {
  await root.locator('label.lw__choice', { hasText: name }).first().click();
}

test.describe('módulo 13: comunicação sem fio', () => {
  test('the module page lists the four lessons', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(MODULE);
    for (const slug of LESSONS) {
      await expect(page.locator(`a[href$="/${MODULE}${slug}/"]`).first()).toBeVisible();
    }
    errors.expectClean();
  });

  for (const slug of LESSONS) {
    test(`lesson ${slug} loads its simulations and widgets without errors`, async ({ page }) => {
      test.setTimeout(120_000);
      const errors = watchErrors(page);
      await page.goto(`${MODULE}${slug}/`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await hydrateAll(page);
      await expectNoHorizontalOverflow(page);
      await expectAccessible(page);
      errors.expectClean();
    });
  }

  test('the spectrum of lesson 13.1 gives the wavelength of the gate remote and of Wi-Fi', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}01-ondas-eletromagneticas/`);
    const espectro = await widget(page, 'section.espectro');
    await expect(espectro.locator('[data-lambda]')).toHaveText(/69,1\scm/);
    await expect(espectro.locator('[data-antena]')).toHaveText(/17,3\scm/);
    await choose(espectro, 'Wi-Fi 2,4 GHz');
    await expect(espectro.locator('[data-lambda]')).toHaveText(/12,3\scm/);
    await choose(espectro, 'Controle da TV');
    await expect(espectro.locator('[data-faixa]')).toHaveAttribute('data-faixa', 'infravermelho');
    await expect(espectro.locator('[data-antena]')).toHaveText('—');
    errors.expectClean();
  });

  test('cutting the antenna of lesson 13.2 shortens the range', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}02-antenas/`);
    const antena = await widget(page, 'section.antena');
    const range = antena.locator('[data-alcance]');
    await expect(range).toHaveText(/^64\sm$/);
    await antena.getByRole('slider', { name: /Comprimento do fio/ }).fill('8');
    await expect(range).toHaveText(/^25\sm$/);
    await antena.getByRole('slider', { name: /Comprimento do fio/ }).fill('17');
    await antena.getByRole('checkbox', { name: /caixa de metal/ }).check();
    await expect(range).toHaveText(/^11\sm$/);
    errors.expectClean();
  });

  test('the receiver of lesson 13.3 obeys a fixed-code copy and refuses a rolling-code one', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}03-controles-remotos/`);
    const bits = await widget(page, 'section.bits');
    const verdict = bits.locator('[data-veredito]');
    const press = bits.getByRole('button', { name: 'Apertar o botão' });
    const replay = bits.getByRole('button', { name: 'Repetir o código copiado' });

    await press.click();
    await expect(verdict).toHaveAttribute('data-veredito', 'desconhecido');
    await bits.getByRole('button', { name: 'Cadastrar' }).click();
    await press.click();
    await expect(verdict).toHaveAttribute('data-veredito', 'cadastrado');
    await replay.click();
    await expect(verdict).toHaveAttribute('data-veredito', 'aceito');

    await choose(bits.getByRole('group', { name: 'Tipo do controle' }), 'Rolling code');
    await bits.getByRole('button', { name: 'Cadastrar' }).click();
    await press.click();
    await press.click();
    await expect(verdict).toHaveAttribute('data-veredito', 'aceito');
    await replay.click();
    await expect(verdict).toHaveAttribute('data-veredito', 'repetido');
    errors.expectClean();
  });

  test('the receiver board of lesson 13.3 learns a remote and switches the lamp', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    await page.goto(`${MODULE}03-controles-remotos/`);
    const sim = page.locator('[data-simulation="m13/receptor-rele"]');
    await sim.scrollIntoViewIfNeeded();
    await expect(sim).toHaveAttribute('data-ready', '', HYDRATION);
    await sim.getByRole('button', { name: 'Iniciar simulação', exact: true }).click();
    const controls = sim.locator('.sim-controls');

    const tap = async (name: RegExp) => {
      const button = controls.getByRole('button', { name });
      await button.hover();
      await page.mouse.down();
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      await page.waitForTimeout(300);
      await page.mouse.up();
    };

    await tap(/^Botão APRENDER/);
    await expect(sim.getByText(/Modo de cadastro/).first()).toBeVisible({ timeout: 15_000 });
    await tap(/^Apertar o botão do controle/);
    await expect(sim.getByText(/Controle cadastrado/).first()).toBeVisible({ timeout: 15_000 });
    await tap(/^Apertar o botão do controle/);
    await expect(sim.getByText(/relé ligado/).first()).toBeVisible({ timeout: 15_000 });
    await tap(/^Copiador/);
    await expect(sim.getByText(/Código repetido recusado/).first()).toBeVisible({
      timeout: 15_000,
    });
    errors.expectClean();
  });

  test('the TV remote of lesson 13.4 sends the address and the command of each button', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto(`${MODULE}04-infravermelho-bluetooth-e-wifi/`);
    const ir = await widget(page, 'section.ir');
    await expect(ir.locator('[data-bits="endereco"]')).toHaveText('00000100');
    await expect(ir.locator('[data-bits="comando"]')).toHaveText('00010000');
    await choose(ir, 'Volume +');
    await expect(ir.locator('[data-bits="comando"]')).toHaveText('01000000');
    await expect(ir.locator('[data-bits="comando-inv"]')).toHaveText('10111111');
    await expect(ir.locator('[data-decodificado]')).toContainText('comando 0x02');
    errors.expectClean();
  });
});
