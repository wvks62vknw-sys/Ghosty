/**
 * Everything the brain receives from Cloudflare: bindings, variables and secrets.
 * Plain settings live in wrangler.jsonc "vars"; secrets can be added in the dashboard
 * (Worker > Settings > Variables and Secrets) but none are required.
 */
export interface Env {
  /** Durable Object namespace holding Ghosty's single agent instance. */
  AGENT: DurableObjectNamespace;
  /** Cloudflare Workers AI (free daily allowance, no key): Ghosty's always-available fallback brain. */
  AI?: {
    run(model: string, inputs: Record<string, unknown>): Promise<unknown>;
    /** Converts documents (PDF, Office, HTML…) to Markdown text. Used for library uploads the browser can't read itself. */
    toMarkdown?(files: { name: string; blob: Blob }[]): Promise<{ name: string; format?: string; data?: string; error?: string }[]>;
  };
  /** The built interface (apps/web/dist), served for every path outside /api. */
  ASSETS?: { fetch(req: Request): Promise<Response> };
  /**
   * Cloudflare KV (free, with its own daily allowance separate from the database's): pages
   * Ghosty published and jobs in flight, so links stay up and publishing works while the
   * database is paused. Bound as "SITES" in wrangler.jsonc.
   */
  SITES?: {
    get(key: string, type: 'json'): Promise<unknown>;
    /** Raw bytes (a picture the Lens shared, see lens.ts), or null when there is none. */
    get(key: string, type: 'arrayBuffer'): Promise<ArrayBuffer | null>;
    /** `expirationTtl` (seconds, 60 or more): the record removes itself — a shared picture lasts a day. */
    put(key: string, value: string | ArrayBuffer, options?: { expirationTtl?: number }): Promise<void>;
    delete(key: string): Promise<void>;
  };
  /**
   * Cloudflare KV holding the vault's mirror: the same encrypted keys as the database (and the
   * brain's own vault key), so keys saved while the database is paused are kept at once and a
   * brain that restarts during the pause still has them. Bound as "VAULT" in production only —
   * previews (unreviewed changes) never see it.
   */
  VAULT?: { get(key: string, type: 'text'): Promise<string | null>; put(key: string, value: string): Promise<void>; delete(key: string): Promise<void> };

  /** Your email address. Only this identity may talk to Ghosty. */
  OWNER_EMAIL?: string;
  /** Cloudflare Access team name, e.g. "ghosty" for ghosty.cloudflareaccess.com. */
  ACCESS_TEAM?: string;
  /** Cloudflare Access application audience (AUD) tag. */
  ACCESS_AUD?: string;
  /** Optional fallback password, used before Access is set up. Long and random. */
  OWNER_KEY?: string;
  /** SHA-256 (hex) of the owner password. Lets the password live nowhere but with you. */
  OWNER_KEY_HASH?: string;

  /** Optional secret: 32 random bytes as base64. Without it the brain makes its own key. */
  VAULT_KEY?: string;

  /** "owner/name" of Ghosty's own GitHub repository. */
  GITHUB_REPO?: string;
  /** Ghosty's public address (https://…), for links it hands out when it cannot tell from the request (wrangler.jsonc). */
  PUBLIC_ORIGIN?: string;
  /** Optional: GitHub token as a secret (otherwise set it from the System tab). */
  GITHUB_TOKEN?: string;
  /** Legacy: Cloudflare Pages project name, if the interface is hosted on Pages. */
  PAGES_PROJECT?: string;
  /** "1" inside a Worker Preview (a proposed change being tried out). */
  IS_PREVIEW?: string;

  /**
   * Optional backup copies of API keys as secrets, named <NAME>_KEY (GEMINI_KEY, GROQ_KEY,
   * CEREBRAS_KEY, OPENROUTER_KEY, MISTRAL_KEY, TAVILY_KEY, TOMTOM_KEY, …). The vault falls back
   * to them, and they keep the AI working while the database is unavailable (see kernel/vault.ts).
   */
  [secret: `${string}_KEY`]: string | undefined;

  /** "0" switches off the open, keyless model endpoints (Pollinations); the owner's keys and Workers AI stay. */
  KEYLESS_MODELS?: string;
  /** Testing only: "1" makes the brain use a scripted fake model. Never set in production. */
  MOCK_LLM?: string;
}
