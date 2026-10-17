// @ts-check
/**
 * Offline use and installing the course as an app (@vite-pwa/astro, set up
 * in astro.config.mjs). The service worker keeps:
 * - always, from the first visit: the home page, the offline page, the CSS,
 *   the Latin fonts, the small scripts and every page with a <Workshop>;
 * - every page the student opens (network first, the saved copy offline);
 * - scripts, images and 3D files once used, and the search index.
 * A page never opened, offline, shows src/pages/offline.astro.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findWorkshopIds } from '../workshop/scan.mjs';

const LESSONS = fileURLToPath(new URL('../../content/aulas/', import.meta.url));

/** @param {string} dir @returns {string[]} */
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

/** Built HTML of the lessons that contain a workshop: "m16-portao/05-montar/index.html". */
export function workshopPages(dir = LESSONS) {
  return files(dir)
    .filter(
      (file) => /\.mdx?$/.test(file) && findWorkshopIds(readFileSync(file, 'utf8')).length > 0,
    )
    .map(
      (file) =>
        `${relative(dir, file)
          .split(sep)
          .join('/')
          .replace(/\.mdx?$/, '')}/index.html`,
    );
}

const MAX_PRECACHED_SCRIPT = 300 * 1024;

/**
 * "m01/03/index.html" → "m01/03/" and "index.html" → the site root, the
 * addresses pages are opened at (trailingSlash: 'always').
 * @param {string} url
 * @param {string} root
 */
export function pageUrl(url, root) {
  if (url === 'index.html') return root;
  return url.endsWith('/index.html') ? url.slice(0, -'index.html'.length) : url;
}

/**
 * @param {{ base: string, name: string, shortName: string, description: string }} site
 * @returns {import('@vite-pwa/astro').PwaOptions}
 */
export function pwaOptions({ base, name, shortName, description }) {
  const root = `${base.replace(/\/$/, '')}/`;
  const escaped = root.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  return {
    registerType: 'autoUpdate',
    // Registered by src/course/PwaHead.astro, without reloading open pages.
    injectRegister: false,
    manifest: {
      id: root,
      name,
      short_name: shortName,
      description,
      lang: 'pt-BR',
      dir: 'ltr',
      start_url: root,
      scope: root,
      display: 'standalone',
      orientation: 'any',
      background_color: '#ffffff',
      theme_color: '#1a5bd0',
      categories: ['education'],
      icons: [
        { src: `${root}icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: `${root}icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
        {
          src: `${root}icons/icon-maskable-512.png`,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
      shortcuts: [
        { name: 'Meu progresso', url: `${root}progresso/` },
        { name: 'Buscar no curso', url: `${root}busca/` },
        { name: 'Módulos', url: `${root}modulos/` },
      ],
    },
    workbox: {
      // Pages are separate documents: never answer one with another (SPA fallback).
      navigateFallback: null,
      cleanupOutdatedCaches: true,
      clientsClaim: true,
      skipWaiting: true,
      globPatterns: [
        'index.html',
        'offline/index.html',
        ...workshopPages(),
        '_astro/*.css',
        '_astro/*.js',
        '_astro/*-latin-wght-normal.*.woff2',
        'icons/*.png',
        'favicon.svg',
      ],
      // Size is filtered below without warnings (a warning fails the build).
      maximumFileSizeToCacheInBytes: 50 * 1024 * 1024,
      manifestTransforms: [
        async (entries) => ({
          manifest: entries
            // Big chunks (3D, charts) are cached when a page uses them.
            .filter((e) => !(e.url.endsWith('.js') && e.size > MAX_PRECACHED_SCRIPT))
            .map((e) => ({ ...e, url: pageUrl(e.url, root) })),
          warnings: [],
        }),
      ],
      runtimeCaching: [
        {
          urlPattern: ({ request }) => request.mode === 'navigate',
          handler: 'NetworkFirst',
          options: {
            cacheName: 'curso-paginas',
            networkTimeoutSeconds: 5,
            expiration: { maxEntries: 300 },
            precacheFallback: { fallbackURL: `${root}offline/` },
          },
        },
        {
          urlPattern: new RegExp(`^[^?#]*${escaped}_astro/`),
          handler: 'CacheFirst',
          options: {
            cacheName: 'curso-arquivos',
            expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 90 },
          },
        },
        {
          urlPattern: new RegExp(`^[^?#]*${escaped}pagefind/`),
          handler: 'StaleWhileRevalidate',
          options: { cacheName: 'curso-busca', expiration: { maxEntries: 400 } },
        },
        {
          urlPattern: new RegExp(
            `^[^?#]*${escaped}.*\\.(?:png|jpe?g|webp|avif|svg|glb|gltf|hdr|ktx2)$`,
          ),
          handler: 'CacheFirst',
          options: {
            cacheName: 'curso-midia',
            expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 90 },
          },
        },
      ],
    },
  };
}
