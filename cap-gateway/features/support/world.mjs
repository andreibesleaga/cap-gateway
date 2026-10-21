// Shared state for the scenarios. Meshes are started on first use and reused across scenarios;
// the engine of the main mesh comes from the cucumber profile (worldParameters.engine).
import { setWorldConstructor, setDefaultTimeout, AfterAll } from '@cucumber/cucumber';
import { startMesh, freePort } from '../../test/support/mesh.mjs';
import { startSilentServer, startInvalidLlmServer } from '../../test/support/fakes.mjs';

setDefaultTimeout(120 * 1000);

const meshes = new Map();
let profileEngine;
const fakes = [];

const MAIN = {
  stub: () => ({ responderEnv: { TRANSLATOR_ENGINE: 'stub' } }),
  libretranslate: () => ({
    responderEnv: {
      TRANSLATOR_ENGINE: 'libretranslate',
      TRANSLATOR_URL: process.env.LIBRE_URL ?? 'http://127.0.0.1:5055/translate',
      TRANSLATOR_TIMEOUT: '60000',
    },
    gatewayEnv: { SERVICE_TIMEOUT: '70000' },
  }),
  llm: () => ({
    responderEnv: {
      TRANSLATOR_ENGINE: 'llm',
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ?? '',
      ...(process.env.LLM_MODEL ? { LLM_MODEL: process.env.LLM_MODEL } : {}),
      TRANSLATOR_TIMEOUT: '30000',
    },
    gatewayEnv: { SERVICE_TIMEOUT: '70000' },
  }),
};

const SPECIAL = {
  'no-responder': async () => ({ responders: 0 }),
  'engine-unreachable': async () => ({
    responders: 1,
    responderEnv: {
      TRANSLATOR_ENGINE: 'libretranslate',
      TRANSLATOR_URL: `http://127.0.0.1:${await freePort()}/translate`,
    },
  }),
  'engine-silent': async () => {
    const fake = await startSilentServer();
    fakes.push(fake);
    return {
      fake,
      responders: 1,
      responderEnv: {
        TRANSLATOR_ENGINE: 'libretranslate',
        TRANSLATOR_URL: `${fake.url}/translate`,
        TRANSLATOR_TIMEOUT: '500',
      },
    };
  },
  'llm-invalid': async () => {
    const fake = await startInvalidLlmServer();
    fakes.push(fake);
    return {
      fake,
      responders: 1,
      responderEnv: {
        TRANSLATOR_ENGINE: 'llm',
        OPENROUTER_API_KEY: 'test-key-not-a-secret',
        LLM_BASE_URL: `${fake.url}/v1`,
      },
    };
  },
};

class CapWorld {
  constructor({ attach, parameters }) {
    this.attach = attach;
    this.engine = parameters.engine ?? 'stub';
    profileEngine = this.engine;
  }

  async useMesh(name) {
    if (!meshes.has(name)) {
      const options = name === 'main' ? { responders: 2, ...MAIN[this.engine]() } : await SPECIAL[name]();
      meshes.set(name, { ...(await startMesh(options)), fake: options.fake });
    }
    this.mesh = meshes.get(name);
    return this.mesh;
  }
}
setWorldConstructor(CapWorld);

// lines a responder logged for each alert it handled
export const handledCount = proc => proc.lines.filter(l => /translate: (translated|passthrough|failed)/.test(l)).length;

AfterAll(async () => {
  const main = meshes.get('main');
  if (main && profileEngine === 'llm') {
    const calls = main.responders.flatMap(r => r.lines).filter(l => l.includes('llm call:'));
    const retries = main.responders.flatMap(r => r.lines).filter(l => l.includes('llm attempt failed'));
    const cost = calls.reduce((sum, l) => sum + (Number(/cost=([\d.eE-]+)/.exec(l)?.[1]) || 0), 0);
    const models = [...new Set(calls.map(l => /model=(\S+)/.exec(l)?.[1]))];
    console.log(
      `\nLLM tier: ${calls.length} successful HTTP call(s), ${retries.length} failed attempt(s), model(s) ${models.join(', ')}, reported cost USD ${cost.toFixed(6)}`
    );
  }
  await Promise.all([...meshes.values()].map(m => m.stop()));
  fakes.forEach(f => f.closeAll());
});
