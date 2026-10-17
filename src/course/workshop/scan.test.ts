import { describe, expect, it } from 'vitest';
import { findWorkshopIds } from './scan.mjs';

describe('findWorkshopIds', () => {
  it('finds every quoting style once', () => {
    const mdx = [
      'Texto',
      '<Workshop id="trocar-motor" />',
      "<Workshop\n  id='testar-capacitor'\n/>",
      '<Workshop id={"medir-terra"} />',
      '<Workshop id="trocar-motor" />',
      '<WorkshopNote id="nao" />',
    ].join('\n');
    expect(findWorkshopIds(mdx)).toEqual(['trocar-motor', 'testar-capacitor', 'medir-terra']);
  });
});
