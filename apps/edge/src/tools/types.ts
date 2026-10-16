/**
 * The shape every tool follows. To give Ghosty a new ability:
 *   1. create a file in apps/edge/src/tools/ that exports one or more `Tool` objects
 *   2. add them to the list in apps/edge/src/tools/index.ts
 * The model sees `name`, `description` and `parameters` (JSON Schema) and decides when to call it.
 */
import type { ChatEvent } from '../../../../packages/shared/src/protocol';
import type { Env } from '../env';
import type { Vault } from '../kernel/vault';
import type { GitHub } from '../github';

export type Risk = 'auto' | 'confirm';

export interface JsonSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface ToolContext {
  env: Env;
  storage: DurableObjectStorage;
  vault: Vault;
  emit: (ev: ChatEvent) => void;
  /** True while the owner has unlocked the kernel from the Workshop tab. */
  kernelUnlocked: () => Promise<boolean>;
  /** GitHub client for Ghosty's own repository, or null if not configured. */
  github: () => Promise<GitHub | null>;
  /** Where Ghosty is reached (https://…), for links it hands out; '' when unknown. */
  origin?: string;
}

export interface Tool {
  name: string;
  description: string;
  parameters: JsonSchema;
  /** 'confirm' tools pause and wait for the owner's approval before running. */
  risk: Risk;
  /** 'client' tools are carried out by the interface, not the brain. */
  side?: 'brain' | 'client';
  /** Returns text for the model to read. Throw an Error to report failure. */
  run: (args: Record<string, unknown>, ctx: ToolContext) => Promise<string>;
  /**
   * Optional, for tools that need approval: work out exactly what the owner is approving.
   * Returns the arguments to pin (e.g. the exact commit to merge) and the question to show.
   */
  approval?: (args: Record<string, unknown>, ctx: ToolContext) => Promise<{ args: Record<string, unknown>; reason: string }>;
}

/** Small helpers for reading tool arguments safely. */
export const arg = {
  str(a: Record<string, unknown>, k: string, required = true): string {
    const v = a[k];
    if (typeof v === 'string' && v.trim()) return v;
    if (typeof v === 'number') return String(v);
    if (required) throw new Error(`missing "${k}"`);
    return '';
  },
  num(a: Record<string, unknown>, k: string, fallback?: number): number {
    const v = typeof a[k] === 'string' ? parseFloat(a[k] as string) : a[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (fallback !== undefined) return fallback;
    throw new Error(`missing number "${k}"`);
  },
  bool(a: Record<string, unknown>, k: string, fallback = false): boolean {
    const v = a[k];
    return typeof v === 'boolean' ? v : v === 'true' ? true : v === 'false' ? false : fallback;
  },
};

export function clip(text: string, max = 8000): string {
  return text.length > max ? `${text.slice(0, max)}\n…[truncated, ${text.length - max} more characters]` : text;
}
