import type { Tool } from './types';
import { arg } from './types';

/**
 * detect_crime – basic object detection using a HuggingFace model.
 *
 * The tool expects a base64‑encoded image (data URL) and returns a JSON string
 * describing detected objects: [{ label, confidence, box }].
 *
 * It uses the public inference endpoint `https://api-inference.huggingface.co/models/facebook/detr-resnet-50`.
 * A HuggingFace API token must be stored in the vault under the key `hf_token`.
 */
export const detect_crime: Tool = {
  name: 'detect_crime',
  description: 'Detect objects (including weapons) in a base64‑encoded image using a HuggingFace model.',
  parameters: {
    type: 'object',
    properties: {
      image: { type: 'string', description: 'Base64 data URL of the image (e.g., data:image/jpeg;base64,...)' },
    },
    required: ['image'],
    additionalProperties: false,
  },
  risk: 'auto',
  side: 'brain',
  async run(args, ctx) {
    const image = arg.str(args, 'image');
    const token = await ctx.vault.get('hf_token');
    if (!token) {
      throw new Error('Missing HuggingFace token. Store it in the vault under key "hf_token".');
    }
    const endpoint = 'https://api-inference.huggingface.co/models/facebook/detr-resnet-50';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: image }),
    });
    if (!response.ok) {
      const txt = await response.text();
      throw new Error(`HuggingFace inference failed: ${response.status} ${txt}`);
    }
    const data = await response.json();
    // Expected format: [{label, score, box: [x0, y0, x1, y1]}]
    const objects = (Array.isArray(data) ? data : []).map((obj: any) => ({
      label: obj.label ?? 'unknown',
      confidence: typeof obj.score === 'number' ? obj.score : 0,
      box: Array.isArray(obj.box) ? obj.box : [],
    }));
    return JSON.stringify({ objects });
  },
};
