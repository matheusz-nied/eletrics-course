/** Site-wide names and navigation. Everything here is shown to students (pt-BR). */
export const SITE = {
  name: 'Curso de Eletrônica',
  fullName: 'Curso de Eletrônica e Circuitos Elétricos',
  description:
    'Curso online de eletricidade e eletrônica, dos princípios até tarefas reais, com simulações interativas e modelos 3D.',
  locale: 'pt-BR',
  repository: 'https://github.com/matheusz-nied/eletrics-course',
} as const;

/** The four parts of the curriculum (docs/plano/01-curriculo.md). */
export const PARTS: Record<number, string> = {
  1: 'Fundamentos',
  2: 'Eletromagnetismo, corrente alternada e instalações',
  3: 'Eletrônica',
  4: 'Oficina: prática e casos reais',
};

export const LEVEL_LABELS = {
  B: 'Básico',
  I: 'Intermediário',
  A: 'Avançado',
} as const;

export const SAFETY_LABELS = {
  nenhum: 'Sem risco elétrico',
  'baixa-tensao': 'Baixa tensão',
  rede: 'Rede elétrica',
} as const;

/**
 * Header navigation, as paths relative to the site base.
 * A front adds its page here when the page exists, so no link points to a 404.
 */
export const NAV: { label: string; path: string }[] = [
  { label: 'Módulos', path: 'modulos/' },
  { label: 'Trilhas', path: 'trilhas/' },
  { label: 'Glossário', path: 'glossario/' },
];
