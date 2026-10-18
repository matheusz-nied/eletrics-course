import { describe, expect, it } from 'vitest';
import { normalizeWorkshop } from '../../../course/workshop/format';
import doc from '../oficinas/trocar-motor-portao';

/** The workshop of lesson 16.7 follows docs/plano/05-portao.md, section 6. */
describe('oficina trocar-motor-portao', () => {
  const workshop = normalizeWorkshop(doc, 'trocar-motor-portao');

  it('has the 22 steps in the 4 sections of the plan', () => {
    expect(workshop.sections.map((s) => [s.title, s.steps.length])).toEqual([
      ['Antes de comprar', 2],
      ['Desmontar', 6],
      ['Montar', 7],
      ['Testar e ajustar', 7],
    ]);
    expect(workshop.steps).toHaveLength(22);
    expect(workshop.safety).toBe('rede');
  });

  it('gives every step a stable id of its own', () => {
    for (const s of doc.sections.flatMap((x) => x.steps)) expect(s.id, s.title).toBeTruthy();
  });

  it('keeps the safe order: power off and test before touching, mains wired last', () => {
    const at = (id: string) => workshop.steps.findIndex((s) => s.id === id);
    expect(at('desligar-e-sinalizar')).toBeLessThan(at('testar-ausencia-de-tensao'));
    expect(at('testar-ausencia-de-tensao')).toBeLessThan(at('fotografar-e-etiquetar'));
    expect(at('descarregar-capacitor')).toBeLessThan(at('soltar-e-testar-a-mao'));
    expect(at('ligar-terra-motor-capacitor')).toBeLessThan(at('revisar-e-ligar-rede'));
    expect(at('revisar-e-ligar-rede')).toBeLessThan(at('energizar-e-conferir-leds'));
    const steps = workshop.steps.map((s) => s.number);
    expect(steps).toEqual(Array.from({ length: 22 }, (_, i) => i + 1));
    // Cross references in the text point to the right step numbers.
    expect(workshop.steps[16]?.id).toBe('primeiro-comando-abre');
    expect(workshop.steps[17]?.id).toBe('conferir-fins-de-curso');
    expect(workshop.steps[18]?.id).toBe('ajustar-forca-e-pausa');
  });
});
