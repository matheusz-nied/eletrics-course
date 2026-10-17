import { describe, expect, it } from 'vitest';
import { joinBase } from './url';

describe('joinBase', () => {
  const base = '/eletrics-course/';

  it('joins the base and a relative path', () => {
    expect(joinBase(base, 'm01-eletricidade-do-zero/')).toBe(
      '/eletrics-course/m01-eletricidade-do-zero/',
    );
  });

  it('accepts paths written with a leading slash', () => {
    expect(joinBase(base, '/figuras/lei-de-ohm.svg')).toBe(
      '/eletrics-course/figuras/lei-de-ohm.svg',
    );
  });

  it('works whether or not the base ends with a slash', () => {
    expect(joinBase('/eletrics-course', 'busca/')).toBe('/eletrics-course/busca/');
  });

  it('points to the site root without a path', () => {
    expect(joinBase(base)).toBe('/eletrics-course/');
    expect(joinBase('/')).toBe('/');
  });

  it('keeps hashes and query strings', () => {
    expect(joinBase(base, '#modulos')).toBe('/eletrics-course/#modulos');
    expect(joinBase(base, 'busca/?q=ohm')).toBe('/eletrics-course/busca/?q=ohm');
  });

  it('leaves external URLs alone', () => {
    expect(joinBase(base, 'https://example.com/x')).toBe('https://example.com/x');
    expect(joinBase(base, '//cdn.example.com/x')).toBe('//cdn.example.com/x');
    expect(joinBase(base, 'mailto:a@b.c')).toBe('mailto:a@b.c');
  });
});
