// Deterministic stand-in for global fetch: answers from a list, records every call.
// An entry is { status?, json } | { status?, text } | an Error to throw | a function (url, init) => entry.
export function fakeFetch(...answers) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({
      url: String(url),
      method: init.method ?? 'GET',
      headers: init.headers ?? {},
      body: init.body,
      signal: init.signal,
    });
    let answer = answers[Math.min(calls.length - 1, answers.length - 1)];
    if (typeof answer === 'function') answer = answer(url, init);
    if (answer instanceof Error) throw answer;
    const body = 'json' in answer ? JSON.stringify(answer.json) : answer.text;
    return new Response(body, { status: answer.status ?? 200, headers: { 'content-type': 'application/json' } });
  };
  return { fetch, calls, json: i => JSON.parse(calls[i].body) };
}

export const timeoutError = () => new DOMException('The operation was aborted due to timeout', 'TimeoutError');
