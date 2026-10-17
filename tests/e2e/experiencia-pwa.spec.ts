import { expect, test, type Page } from '@playwright/test';
import { EXAMPLE_LESSON } from './helpers';

// Lets context.route() see the service worker's own requests (Chromium), to
// cut the network for it as well.
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1';

/** Waits until the service worker is active and controls the page. */
async function serviceWorkerReady(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }),
      );
    }
  });
}

test.describe('installable app', () => {
  test('has a web manifest in Portuguese with the app icons', async ({ page, request }) => {
    await page.goto('');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBe('/eletrics-course/manifest.webmanifest');
    const manifest = await (await request.get(href!)).json();
    expect(manifest).toMatchObject({
      name: 'Curso de Eletrônica e Circuitos Elétricos',
      short_name: 'Eletrônica',
      lang: 'pt-BR',
      start_url: '/eletrics-course/',
      scope: '/eletrics-course/',
      display: 'standalone',
    });
    const icons = manifest.icons as { src: string; sizes: string; purpose: string }[];
    expect(icons.map((i) => `${i.sizes} ${i.purpose}`)).toEqual([
      '192x192 any',
      '512x512 any',
      '512x512 maskable',
    ]);
    for (const icon of icons) {
      const response = await request.get(icon.src);
      expect(response.status(), icon.src).toBe(200);
      expect(response.headers()['content-type']).toContain('image/png');
    }
  });

  test('passes the browser installability checks', async ({ page, context }) => {
    await page.goto('');
    await serviceWorkerReady(page);
    const cdp = await context.newCDPSession(page);
    const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
    expect(installabilityErrors).toEqual([]);
  });
});

test.describe('offline', () => {
  test('keeps the visited pages and the workshops, and explains the rest', async ({
    page,
    context,
  }) => {
    await page.goto('');
    await serviceWorkerReady(page);
    await page.reload();
    await page.goto('glossario/tensao/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tensão elétrica');

    // No internet from here on.
    await context.route('**/*', (route) => route.abort('internetdisconnected'));

    // A page opened before.
    await page.goto('glossario/tensao/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tensão elétrica');

    // A page with a workshop is saved from the first visit to the site.
    await page.goto(EXAMPLE_LESSON);
    await expect(page.locator('#oficina-exemplo')).toContainText(
      'Testar uma pilha com o multímetro',
    );

    // A page never opened: the offline page, listing what is saved.
    await page.goto('glossario/borne/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sem internet');
    await expect(page.getByRole('link', { name: 'Tensão elétrica' })).toBeVisible();
  });

  test('the progress page reports offline use as ready', async ({ page }) => {
    await page.goto('progresso/');
    await serviceWorkerReady(page);
    await expect(page.locator('[data-offline-status]')).toHaveAttribute('data-state', 'pronto');
    await expect(page.locator('[data-offline-status]')).toContainText(
      'Pronto para usar sem internet',
    );
  });
});
