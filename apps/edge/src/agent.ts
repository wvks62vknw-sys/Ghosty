/**
 * GhostyAgent — the brain. One Durable Object instance holds Ghosty's conversation,
 * memory, widgets, encrypted keys and model health, and runs the agent loop:
 *
 *   owner message → model → (tool calls → results → model)* → reply
 *
 * Events stream back to the interface as newline-delimited JSON (see ChatEvent).
 */
import type { BrainStatus, ChatEvent, ChatTurn, KeyStatus } from '../../../packages/shared/src/protocol';
import type { Env } from './env';
import { GitHub } from './github';
import { KEYS } from './keys';
import { needsApproval } from './kernel/permissions';
import { Vault } from './kernel/vault';
import { Router, type Msg, type ToolCall } from './llm/router';
import { systemPrompt, type ClientContext } from './prompt';
import { toolByName, toolSpecs } from './tools';
import { loadMemory, addFact, MEMORY_KEY } from './tools/memory';
import { repoTools } from './tools/repo';
import type { ToolContext } from './tools/types';
import { loadWidgets, deleteWidget } from './tools/widgets';

const MAX_STEPS = 14;
const CTX_KEY = 'ctx';
const TURNS_KEY = 'turns';
const PENDING_KEY = 'pending';

interface Pending {
  id: string;
  calls: ToolCall[];
  client: ClientContext;
  at: number;
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

function stream(): { response: Response; emit: (ev: ChatEvent) => void; close: () => Promise<void> } {
  const ts = new TransformStream<Uint8Array, Uint8Array>();
  const writer = ts.writable.getWriter();
  const enc = new TextEncoder();
  let open = true;
  return {
    response: new Response(ts.readable, { headers: { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' } }),
    emit: (ev) => {
      if (open) writer.write(enc.encode(`${JSON.stringify(ev)}\n`)).catch(() => (open = false));
    },
    close: async () => {
      open = false;
      await writer.close().catch(() => undefined);
    },
  };
}

/** Keep the model's working context small enough for free models and storage limits. */
function trimContext(msgs: Msg[]): Msg[] {
  let out = msgs.slice(-36);
  while (out.length && out[0]!.role !== 'user') out = out.slice(1);
  return out.map((m, i) => (m.role === 'tool' && i < out.length - 8 && (m.content?.length ?? 0) > 600 ? { ...m, content: `${m.content!.slice(0, 600)}…[older tool output trimmed]` } : m));
}

export class GhostyAgent {
  private vault: Vault;
  private router: Router;
  private busy: AbortController | null = null;

  constructor(
    private state: DurableObjectState,
    private env: Env,
  ) {
    this.vault = new Vault(state.storage, env);
    this.router = new Router(state.storage, this.vault, env);
  }

  private get storage() {
    return this.state.storage;
  }

  private async github(): Promise<GitHub | null> {
    const token = (await this.vault.get('github')) || this.env.GITHUB_TOKEN;
    if (!token || !this.env.GITHUB_REPO) return null;
    return new GitHub(token, this.env.GITHUB_REPO, this.env.PAGES_PROJECT);
  }

  private toolContext(emit: (ev: ChatEvent) => void): ToolContext {
    return {
      env: this.env,
      storage: this.storage,
      vault: this.vault,
      emit,
      kernelUnlocked: async () => ((await this.storage.get<number>('kernelUnlockedUntil')) ?? 0) > Date.now(),
      github: () => this.github(),
    };
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/api/, '');
    const method = req.method;
    try {
      if (path === "/chat" && method === "POST") return await this.chat(req);
      if (path === '/approve' && method === 'POST') return await this.approve(req);
      if (path === '/stop' && method === 'POST') {
        this.busy?.abort();
        this.busy = null;
        return json({ ok: true });
      }
      if (path === '/history' && method === 'GET') return json({ turns: (await this.storage.get<ChatTurn[]>(TURNS_KEY)) ?? [], pending: await this.pendingInfo() });
      if (path === '/history' && method === 'DELETE') {
        await this.storage.delete([TURNS_KEY, CTX_KEY, PENDING_KEY]);
        return json({ ok: true });
      }
      if (path === '/memory' && method === 'GET') return json({ facts: await loadMemory(this.storage) });
      if (path === '/memory' && method === 'POST') {
        const { text } = (await req.json()) as { text: string };
        return json({ fact: await addFact(this.storage, String(text ?? '')) });
      }
      if (path.startsWith('/memory/') && method === 'DELETE') {
        const id = decodeURIComponent(path.slice(8));
        await this.storage.put(MEMORY_KEY, (await loadMemory(this.storage)).filter((f) => f.id !== id));
        return json({ ok: true });
      }
      if (path === '/status' && method === 'GET') return json(await this.status(req.headers.get('x-ghosty-owner') ?? 'owner'));
      if (path === '/keys' && method === 'POST') {
        const { name, value } = (await req.json()) as { name: string; value: string };
        if (!KEYS.some((k) => k.name === name)) return json({ error: 'unknown key' }, 400);
        await this.vault.set(name, String(value ?? '').trim());
        await this.router.resetHealth();
        if (name !== 'github' && value) this.state.waitUntil(this.router.discover(true));
        return json({ ok: true });
      }
      if (path === '/models/reset' && method === 'POST') {
        await this.router.resetHealth();
        await this.router.discover(true);
        return json({ models: await this.router.summary() });
      }
      if (path === '/models/order' && method === 'POST') {
        const { order } = (await req.json()) as { order: string[] };
        await this.router.setOrder(Array.isArray(order) ? order.map(String) : []);
        return json({ ok: true });
      }
      if (path === '/widgets' && method === 'GET') return json({ widgets: await loadWidgets(this.storage) });
      if (path.startsWith('/widgets/') && method === 'DELETE') {
        await deleteWidget(this.storage, decodeURIComponent(path.slice(9)));
        return json({ ok: true });
      }
      if (path === '/changes' && method === 'GET') {
        const g = await this.github();
        if (!g) return json({ ready: false, changes: [], versions: [] });
        const main = await g.defaultBranch();
        const [changes, versions] = await Promise.all([g.openChanges(), g.versions(main)]);
        return json({ ready: true, changes, versions });
      }
      const m = path.match(/^\/changes\/(\d+)\/(ship|discard)$/);
      if (m && method === 'POST') {
        // The Workshop sends the exact commit the owner was looking at; shipping is pinned to it.
        const body = m[2] === 'ship' ? ((await req.json().catch(() => ({}))) as { sha?: string }) : {};
        return await this.ownerTool(m[2] === 'ship' ? 'ship_change' : 'discard_change', { pr: Number(m[1]), sha: body.sha });
      }
      const v = path.match(/^\/versions\/([0-9a-f]{40})\/restore$/);
      if (v && method === 'POST') return await this.ownerTool('restore_version', { sha: v[1] });
      if (path === '/kernel' && method === 'POST') {
        const { minutes } = (await req.json()) as { minutes: number };
        const mins = Math.max(0, Math.min(60, Number(minutes) || 0));
        await this.storage.put('kernelUnlockedUntil', mins ? Date.now() + mins * 60_000 : 0);
        return json({ kernelUnlockedUntil: mins ? Date.now() + mins * 60_000 : 0 });
      }
      if (path === '/stt' && method === 'POST') return await this.stt(req);
      return json({ error: 'not found' }, 404);
    } catch (e) {
      return json({ error: String((e as Error)?.message ?? e) }, 500);
    }
  }

  /** Owner-initiated actions from Workshop buttons. The button press IS the approval. */
  private async ownerTool(name: string, args: Record<string, unknown>): Promise<Response> {
    const tool = repoTools.find((t) => t.name === name)!;
    const result = await tool.run(args, this.toolContext(() => undefined));
    return json({ ok: true, result });
  }

  private async status(owner: string): Promise<BrainStatus> {
    const keys: KeyStatus[] = [];
    for (const k of KEYS) keys.push({ name: k.name, label: k.label, set: await this.vault.has(k.name), hint: k.hint, link: k.link });
    if (this.env.GITHUB_TOKEN) keys.find((k) => k.name === 'github')!.set = true;
    this.state.waitUntil(this.router.discover(false));
    return {
      owner,
      repo: this.env.GITHUB_REPO ?? null,
      repoReady: !!(await this.github()),
      pagesProject: this.env.PAGES_PROJECT ?? null,
      kernelUnlockedUntil: (await this.storage.get<number>('kernelUnlockedUntil')) ?? 0,
      keys,
      models: await this.router.summary(),
      lastModel: (await this.storage.get<string>('llm:last')) ?? null,
    };
  }

  private async pendingInfo() {
    const p = await this.storage.get<Pending>(PENDING_KEY);
    if (!p) return null;
    const c = p.calls[0]!;
    return { id: p.id, name: c.function.name, args: safeArgs(c.function.arguments) };
  }

  private async addTurn(turn: ChatTurn): Promise<void> {
    const turns = (await this.storage.get<ChatTurn[]>(TURNS_KEY)) ?? [];
    turns.push(turn);
    await this.storage.put(TURNS_KEY, turns.slice(-120));
  }

  private begin(): { s: ReturnType<typeof stream>; signal: AbortSignal } | Response {
    if (this.busy) return json({ error: 'I am still working on the previous request. Say "stop" to cancel it.' }, 409);
    const ctl = new AbortController();
    this.busy = ctl;
    return { s: stream(), signal: ctl.signal };
  }

  private async chat(req: Request): Promise<Response> {
    const body = (await req.json()) as { message: string; context?: ClientContext };
    const text = String(body.message ?? '').trim().slice(0, 12000);
    if (!text) return json({ error: 'empty message' }, 400);
    const started = this.begin();
    if (started instanceof Response) return started;
    const { s, signal } = started;
    const client = body.context ?? {};
    this.state.waitUntil(
      (async () => {
        try {
          const prev = (await this.storage.get<Msg[]>(CTX_KEY)) ?? [];
          const stale = await this.storage.get<Pending>(PENDING_KEY);
          if (stale) {
            // The owner moved on without answering an approval: close those calls off.
            for (const c of stale.calls) prev.push({ role: 'tool', tool_call_id: c.id, content: 'Not run: the owner moved on without approving.' });
            await this.storage.delete(PENDING_KEY);
          }
          await this.addTurn({ role: 'user', text, at: Date.now() });
          const ctx = trimContext([...prev, { role: 'user', content: text }]);
          await this.loop(ctx, client, s.emit, signal);
        } catch (e) {
          s.emit({ t: 'error', message: String((e as Error)?.message ?? e) });
        } finally {
          this.busy = null;
          await s.close();
        }
      })(),
    );
    return s.response;
  }

  private async approve(req: Request): Promise<Response> {
    const body = (await req.json()) as { id: string; allow: boolean };
    const pending = await this.storage.get<Pending>(PENDING_KEY);
    if (!pending || pending.id !== body.id) return json({ error: 'nothing is waiting for approval' }, 404);
    const started = this.begin();
    if (started instanceof Response) return started;
    const { s, signal } = started;
    this.state.waitUntil(
      (async () => {
        try {
          await this.storage.delete(PENDING_KEY);
          const ctx = (await this.storage.get<Msg[]>(CTX_KEY)) ?? [];
          const paused = await this.runCalls(ctx, pending.calls, pending.client, s.emit, body.allow ? 'approved' : 'declined');
          if (!paused) await this.loop(ctx, pending.client, s.emit, signal);
        } catch (e) {
          s.emit({ t: 'error', message: String((e as Error)?.message ?? e) });
        } finally {
          this.busy = null;
          await s.close();
        }
      })(),
    );
    return s.response;
  }

  /**
   * Run tool calls in order. Returns true if it paused for approval.
   * `first` decides the fate of calls[0] when resuming after an approval prompt.
   */
  private async runCalls(ctx: Msg[], calls: ToolCall[], client: ClientContext, emit: (ev: ChatEvent) => void, first?: 'approved' | 'declined'): Promise<boolean> {
    const tctx = this.toolContext(emit);
    for (let i = 0; i < calls.length; i++) {
      const call = calls[i]!;
      const tool = toolByName.get(call.function.name);
      const args = safeArgs(call.function.arguments);
      let result: string;
      if (!tool) {
        result = `Error: there is no tool called ${call.function.name}.`;
      } else if (i === 0 && first === 'declined') {
        result = 'The owner declined this action. Do not retry it unless they ask again.';
        emit({ t: 'tool_result', id: call.id, name: tool.name, ok: false, summary: 'declined by you' });
      } else if (needsApproval(tool) && !(i === 0 && first === 'approved')) {
        // Work out exactly what is being approved (e.g. pin the commit to merge) BEFORE asking.
        let reason = describe(tool.name, args);
        let pinned = args;
        if (tool.approval) {
          try {
            const info = await tool.approval(args, tctx);
            reason = info.reason;
            pinned = info.args;
          } catch (e) {
            result = `Error: ${String((e as Error)?.message ?? e)}`;
            emit({ t: 'tool_result', id: call.id, name: tool.name, ok: false, summary: result.slice(0, 280) });
            ctx.push({ role: 'tool', tool_call_id: call.id, content: result });
            continue;
          }
        }
        const id = crypto.randomUUID().slice(0, 12);
        const pinnedCalls = [{ ...call, function: { ...call.function, arguments: JSON.stringify(pinned) } }, ...calls.slice(i + 1)];
        await this.storage.put(PENDING_KEY, { id, calls: pinnedCalls, client, at: Date.now() } satisfies Pending);
        await this.storage.put(CTX_KEY, ctx);
        emit({ t: 'approval', id, name: tool.name, args: pinned, reason });
        emit({ t: 'done', model: (await this.storage.get<string>('llm:last')) ?? '' });
        return true;
      } else {
        emit({ t: 'tool', id: call.id, name: tool.name, args });
        try {
          result = await tool.run(args, tctx);
          emit({ t: 'tool_result', id: call.id, name: tool.name, ok: true, summary: result.slice(0, 280) });
        } catch (e) {
          result = `Error: ${String((e as Error)?.message ?? e)}`;
          emit({ t: 'tool_result', id: call.id, name: tool.name, ok: false, summary: result.slice(0, 280) });
        }
      }
      ctx.push({ role: 'tool', tool_call_id: call.id, content: result.slice(0, 14000) });
    }
    return false;
  }

  private async loop(ctx: Msg[], client: ClientContext, emit: (ev: ChatEvent) => void, signal: AbortSignal): Promise<void> {
    const specs = toolSpecs();
    const repoReady = !!(await this.github());
    for (let step = 0; step < MAX_STEPS; step++) {
      if (signal.aborted) {
        emit({ t: 'error', message: 'Stopped.' });
        break;
      }
      const facts = await loadMemory(this.storage);
      emit({ t: 'status', text: step ? 'thinking about the results…' : 'thinking…' });
      const { message, model } = await this.router.complete([{ role: 'system', content: systemPrompt(client, facts, repoReady) }, ...ctx], specs, signal);
      ctx.push(message);
      const calls = message.tool_calls ?? [];
      if (!calls.length) {
        const text = message.content?.trim() || 'Done.';
        emit({ t: 'text', text });
        emit({ t: 'done', model });
        await this.addTurn({ role: 'assistant', text, at: Date.now(), model });
        await this.storage.put(CTX_KEY, trimContext(ctx));
        return;
      }
      if (message.content?.trim()) emit({ t: 'status', text: message.content.trim().slice(0, 300) });
      if (await this.runCalls(ctx, calls, client, emit)) return;
      await this.storage.put(CTX_KEY, trimContext(ctx));
    }
    const text = `I have taken ${MAX_STEPS} steps on this and stopped to check in. Say "carry on" and I will continue.`;
    emit({ t: 'text', text });
    emit({ t: 'done', model: (await this.storage.get<string>('llm:last')) ?? '' });
    await this.addTurn({ role: 'assistant', text, at: Date.now() });
    await this.storage.put(CTX_KEY, trimContext(ctx));
  }

  /** Speech to text through Groq Whisper (needs the Groq key). */
  private async stt(req: Request): Promise<Response> {
    const key = await this.vault.get('groq');
    if (!key) return json({ error: 'no groq key' }, 400);
    const type = req.headers.get('content-type') ?? 'audio/webm';
    const audio = await req.arrayBuffer();
    if (audio.byteLength > 8_000_000) return json({ error: 'recording too long' }, 413);
    const ext = /mp4/.test(type) ? 'mp4' : /ogg/.test(type) ? 'ogg' : 'webm';
    const fd = new FormData();
    fd.append('file', new Blob([audio], { type }), `speech.${ext}`);
    fd.append('model', 'whisper-large-v3-turbo');
    fd.append('response_format', 'json');
    fd.append('temperature', '0');
    const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: fd });
    if (!r.ok) return json({ error: `whisper ${r.status}` }, 502);
    const j = (await r.json()) as { text?: string };
    return json({ text: j.text ?? '' });
  }
}

function safeArgs(raw: string): Record<string, unknown> {
  try {
    const v = JSON.parse(raw || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function describe(name: string, args: Record<string, unknown>): string {
  if (name === 'ship_change') return `Ship change #${args.pr} to your live Ghosty?`;
  if (name === 'restore_version') return `Roll Ghosty back to version ${String(args.sha).slice(0, 7)}?`;
  return `Allow ${name.replace(/_/g, ' ')}?`;
}
