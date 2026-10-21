// Profiles: default = stub engine (deterministic, CI); libre and llm run the @translation / @llm scenarios
// against a real engine (see docs/TESTING.md). All profiles start real gateway and responder processes.
const common = {
  paths: ['features/**/*.feature'],
  import: ['features/support/**/*.mjs', 'features/step_definitions/**/*.mjs'],
  format: ['progress'],
};

export default { ...common, tags: 'not @real-engine', worldParameters: { engine: 'stub' } };
export const libre = { ...common, tags: '@translation', worldParameters: { engine: 'libretranslate' } };
export const llm = { ...common, tags: '@llm', worldParameters: { engine: 'llm' } };
