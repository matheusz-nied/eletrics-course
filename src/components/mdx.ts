/**
 * Components available in every lesson without imports
 * (docs/plano/02-arquitetura.md, section 4.3). The names are fixed: each
 * owning front replaces its file, never this map.
 */
import Simulation from '../circuit/Simulation.astro';
import Plot from '../circuit/Plot.astro';
import Model3D from '../three/Model3D.astro';
import Scene3D from '../scenes/Scene3D.astro';
import WiringExercise from '../bench/WiringExercise.astro';
import Quiz from '../course/Quiz.astro';
import Term from '../course/Term.astro';
import Workshop from '../course/Workshop.astro';
import Callout from './Callout.astro';
import DeepDive from './DeepDive.astro';
import Figure from './Figure.astro';
import RealCase from './RealCase.astro';
import Step from './Step.astro';
import Steps from './Steps.astro';
import Table from './Table.astro';

export const components = {
  // Fundação
  Callout,
  Figure,
  Steps,
  Step,
  DeepDive,
  RealCase,
  // Experiência
  Term,
  Quiz,
  Workshop,
  // Esquemático
  Simulation,
  Plot,
  // Kit 3D
  Model3D,
  // Cenas reais
  Scene3D,
  // Bancada
  WiringExercise,
  // Markdown element overrides
  table: Table,
};
