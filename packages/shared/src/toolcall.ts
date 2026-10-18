/**
 * How the offline brain writes a tool call: Qwen3's own format (the "hermes" style its chat template
 * was trained on) — the tools listed as JSON inside <tools></tools> in the system message, a call as
 * one JSON object inside <tool_call></tool_call>, and the result handed back inside
 * <tool_response></tool_response> in a user turn. The weekly training (apps/edge/src/selftrain) writes
 * its tool-use examples in exactly this shape, and the exam reads a model's call back with
 * `readToolCall`. Pure: the phone, the brain and the tests share it.
 *
 * (The phone's offline brain does not run tools yet — offline/prompt.ts says so to the model. This is
 * the format it is being taught, so a later part can switch tools on without retraining.)
 */

export interface ToolSpec {
  name: string;
  description: string;
  /** JSON Schema for the arguments (an object with properties / required). */
  parameters: { type: 'object'; properties: Record<string, { type?: string; description?: string; enum?: unknown[] }>; required?: string[] };
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

/** The system-message paragraph that offers the tools (Qwen3's template wording, shortened). */
export function toolsBlock(tools: ToolSpec[]): string {
  const lines = tools.map((t) => JSON.stringify({ type: 'function', function: t }));
  return (
    '# Tools\n\nYou may call one or more functions to assist with the user query.\n\n' +
    `You are provided with function signatures within <tools></tools> XML tags:\n<tools>\n${lines.join('\n')}\n</tools>\n\n` +
    'For each function call, return a json object with function name and arguments within <tool_call></tool_call> XML tags:\n' +
    '<tool_call>\n{"name": <function-name>, "arguments": <args-json-object>}\n</tool_call>'
  );
}

/** One call as the model should write it. */
export const toolCallText = (c: ToolCall): string => `<tool_call>\n${JSON.stringify({ name: c.name, arguments: c.arguments })}\n</tool_call>`;

/** A tool's result as it goes back to the model (in a user turn). */
export const toolResponseText = (result: string): string => `<tool_response>\n${result}\n</tool_response>`;

/** Every call in a reply, in order; a block that is not one JSON object with a string name is skipped. */
export function readToolCalls(text: string): ToolCall[] {
  const out: ToolCall[] = [];
  for (const m of text.matchAll(/<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g)) {
    try {
      const o = JSON.parse(m[1]!) as { name?: unknown; arguments?: unknown };
      if (typeof o.name !== 'string' || !o.name) continue;
      const args = typeof o.arguments === 'string' ? (JSON.parse(o.arguments) as unknown) : (o.arguments ?? {});
      if (!args || typeof args !== 'object' || Array.isArray(args)) continue;
      out.push({ name: o.name, arguments: args as Record<string, unknown> });
    } catch {
      /* not JSON: not a call */
    }
  }
  return out;
}

/** The first call in a reply, or null. */
export const readToolCall = (text: string): ToolCall | null => readToolCalls(text)[0] ?? null;

const typeOk = (v: unknown, t?: string): boolean =>
  !t ||
  (t === 'string' ? typeof v === 'string' : t === 'number' ? typeof v === 'number' && Number.isFinite(v) : t === 'integer' ? Number.isInteger(v) : t === 'boolean' ? typeof v === 'boolean' : t === 'array' ? Array.isArray(v) : t === 'object' ? !!v && typeof v === 'object' && !Array.isArray(v) : true);

/**
 * Whether a call fits its tool's schema: a known tool, every required argument there, no argument the
 * tool does not have, each of the declared type (and in its list, when it has one). Returns the problem in
 * words, or '' when it fits.
 */
export function schemaProblem(call: ToolCall, tools: ToolSpec[]): string {
  const t = tools.find((x) => x.name === call.name);
  if (!t) return `no tool called ${call.name}`;
  const props = t.parameters.properties ?? {};
  for (const r of t.parameters.required ?? []) if (call.arguments[r] === undefined || call.arguments[r] === '') return `${call.name} needs ${r}`;
  for (const [k, v] of Object.entries(call.arguments)) {
    const p = props[k];
    if (!p) return `${call.name} has no argument ${k}`;
    if (!typeOk(v, p.type)) return `${call.name}.${k} should be a ${p.type}`;
    if (p.enum && !p.enum.includes(v)) return `${call.name}.${k} must be one of ${p.enum.join(', ')}`;
  }
  return '';
}
