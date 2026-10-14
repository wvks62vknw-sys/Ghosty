/**
 * Everything the brain receives from Cloudflare: bindings, variables and secrets.
 * Set variables in the dashboard (Worker > Settings > Variables and Secrets).
 */
export interface Env {
  /** Durable Object namespace holding Ghosty's single agent instance. */
  AGENT: DurableObjectNamespace;

  /** Your email address. Only this identity may talk to Ghosty. */
  OWNER_EMAIL?: string;
  /** Cloudflare Access team name, e.g. "ghosty" for ghosty.cloudflareaccess.com. */
  ACCESS_TEAM?: string;
  /** Cloudflare Access application audience (AUD) tag. */
  ACCESS_AUD?: string;
  /** Optional fallback password, used before Access is set up. Long and random. */
  OWNER_KEY?: string;

  /** Secret: 32 random bytes as base64. Encrypts API keys stored in the vault. */
  VAULT_KEY?: string;

  /** "owner/name" of Ghosty's own GitHub repository. */
  GITHUB_REPO?: string;
  /** Optional: GitHub token as a secret (otherwise set it from the System tab). */
  GITHUB_TOKEN?: string;
  /** Cloudflare Pages project name, used to work out preview links. */
  PAGES_PROJECT?: string;

  /** Testing only: "1" makes the brain use a scripted fake model. Never set in production. */
  MOCK_LLM?: string;
}
