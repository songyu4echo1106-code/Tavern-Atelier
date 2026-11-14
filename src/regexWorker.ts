interface RegexRequest {
  findRegex: string;
  replaceString: string;
  trimStrings: string[];
  substituteRegex: number;
  input: string;
  char: string;
  user: string;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compile(value: string): RegExp {
  const literal = value.match(/^\/(.*)\/([a-z]*)$/s);
  return literal ? new RegExp(literal[1], literal[2]) : new RegExp(value);
}

function expanded(template: string, match: string, captures: string[], trimmed: string, named: Record<string, string>): string {
  return template.replace(/{{match}}|\$\$|\$&|\$(\d{1,2})|\$<([^>]+)>/g, (token, index: string | undefined, name: string | undefined) => {
    if (token === '{{match}}') return trimmed;
    if (token === '$$') return '$';
    if (token === '$&') return match;
    if (name !== undefined) return named[name] ?? '';
    return captures[Number(index) - 1] ?? '';
  });
}

self.onmessage = (event: MessageEvent<RegexRequest>) => {
  try {
    const request = event.data;
    if (!request.findRegex) { self.postMessage({ output: request.input, count: 0 }); return; }
    let pattern = request.findRegex;
    if (request.substituteRegex !== 0) {
      const replaceMacro = (value: string) => request.substituteRegex === 2 ? escapeRegex(value) : value;
      pattern = pattern.replaceAll('{{char}}', replaceMacro(request.char)).replaceAll('{{user}}', replaceMacro(request.user));
    }
    const regex = compile(pattern);
    let count = 0;
    const output = request.input.replace(regex, (...args: unknown[]) => {
      const match = String(args[0]);
      const metadataLength = args.at(-1) && typeof args.at(-1) === 'object' ? 3 : 2;
      const captures = args.slice(1, -metadataLength).map((value) => value === undefined ? '' : String(value));
      const named = metadataLength === 3 ? args.at(-1) as Record<string, string> : {};
      const trimmed = request.trimStrings.reduce((value, trim) => trim ? value.split(trim).join('') : value, match);
      count += 1;
      return expanded(request.replaceString, match, captures, trimmed, named);
    });
    self.postMessage({ output, count });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
