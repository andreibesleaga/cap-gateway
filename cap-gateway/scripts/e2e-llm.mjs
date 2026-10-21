/**
 * Opt-in E2E tier against a real LLM (OpenRouter by default): runs the @llm scenarios (cucumber profile
 * "llm", 7 chat completions when nothing is retried). Skips with exit code 0 unless OPENROUTER_API_KEY is set.
 * Not part of CI. The key reaches the responder processes only and is never logged.
 */
import { spawn } from 'node:child_process';

if (!process.env.OPENROUTER_API_KEY) {
  console.log('LLM tier skipped: OPENROUTER_API_KEY is not set');
  process.exit(0);
}
const code = await new Promise(resolve =>
  spawn('npx', ['cucumber-js', '--profile', 'llm'], { stdio: 'inherit', env: process.env }).on('exit', resolve)
);
process.exit(code ?? 1);
