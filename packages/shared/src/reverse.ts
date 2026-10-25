/**
 * What Reverse can open, shared by the brain (tools/reverse.ts: what it will start) and the phone
 * (features/reverse: what the box reads as while he types, so "kettle" is not taken for a website,
 * or a real kettle, without his knowing).
 */

/** A target is a URL, an npm package name or owner/repo. */
export function normaliseTarget(raw: string): { target: string; kind: string } | null {
  const t = raw.trim();
  if (!t || t.length > 400 || /\s/.test(t)) return null;
  if (/^https?:\/\//i.test(t)) {
    try {
      const u = new URL(t);
      if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(u.hostname) || !u.hostname.includes('.')) return null;
      return { target: u.href, kind: 'auto' };
    } catch {
      return null;
    }
  }
  if (/^[\w.-]+\/[\w.-]+$/.test(t)) return { target: t, kind: 'repo' };
  // "example.com" or "shop.example.co.uk/path" → a website; "lodash.merge" → an npm package
  if (/^[\w-]+(\.[\w-]+)*\.(com|net|org|io|co|uk|de|fr|es|it|nl|se|no|fi|dk|pl|ch|at|eu|app|dev|ai|me|info|xyz|gov|edu|ac|tv|cc|us|ca|au|nz|in|jp|kr|br|mx|ru|cn|hk|sg|ie|tech|site|online|store|cloud|page)(\/.*)?$/i.test(t)) {
    return { target: `https://${t}`, kind: 'web' };
  }
  if (/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(t)) return { target: t, kind: 'npm' };
  return null;
}

/** What a typed target reads as, in his words ("" for an empty box). */
export function readsAs(raw: string): string {
  if (!raw.trim()) return '';
  const n = normaliseTarget(raw);
  if (!n) return 'Reverse opens a link (like bbc.co.uk), a GitHub project (owner/name) or a code package’s name. To learn how a real thing works, ask Ghosty in the chat.';
  const shown = n.target.replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (n.kind === 'repo') return `Reads as a GitHub project: ${shown}.`;
  if (n.kind === 'npm') return `Reads as a code package on npm: “${shown}”. To look at a website or an app, paste its link.`;
  if (/\.(apk|aab|ipa|dll|exe|msi|zip|asar|jar|tgz)(\?|#|$)/i.test(n.target)) return `Reads as an app file: ${shown}.`;
  return `Reads as a website: ${shown}.`;
}
