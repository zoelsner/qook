/**
 * One-off: generate 2 watercolor salmon images for the Paper palette study.
 * One tuned to Maritime sage, one to Spring celadon. ~$0.08 total.
 *
 * Usage:
 *   OPENROUTER_API_KEY=sk-or-v1-... bun scripts/generate-palette-study-images.ts
 *
 * Output: apps/native/assets/palette-study/{maritime-sage,spring-celadon}.png
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const OUTPUT_DIR = join(ROOT, 'apps', 'native', 'assets', 'palette-study');
const MODEL = 'bytedance-seed/seedream-4.5';

const BASE =
  'Loose wet-on-wet watercolor illustration of a maple-glazed salmon fillet with charred broccolini and a lemon wedge on a round off-white ceramic plate viewed from above. Visible cold-press paper texture, organic watercolor bleeds, artful imperfection, centered composition, 1:1 square crop, no text or watermarks.';

interface Variant {
  filename: string;
  palette: string;
  prompt: string;
}

const VARIANTS: Variant[] = [
  {
    filename: 'maritime-sage',
    palette: 'Maritime sage',
    prompt: `${BASE} Palette: pale foam-green wash around the plate, muted seafoam and fog-gray tones in the shadow, coral (#D97757) accent drops, whisper of prussian-navy (#23425B) in the darker broccolini and plate shadow, salmon itself warm but slightly desaturated. Cool seaside morning mood, airy and minimal, no warm cream tones.`,
  },
  {
    filename: 'spring-celadon',
    palette: 'Spring celadon',
    prompt: `${BASE} Palette: pale celadon and butter-yellow wash around the plate, fresh sage-green splash, golden olive-oil highlights, butter-amber (#C98B5F) accent drops, spring-green (#3F6B44) in the broccolini, salmon warm and bright. Fresh spring-meadow mood, garden-light, optimistic and alive.`,
  },
];

async function generateImage(apiKey: string, prompt: string): Promise<Buffer> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      modalities: ['image'],
      image_config: { aspect_ratio: '1:1' },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const message = data.choices?.[0]?.message;
  if (!message) throw new Error('No message in response');

  const images = message.images as
    | Array<{ type: string; image_url: { url: string } }>
    | undefined;
  if (images && images.length > 0) {
    for (const img of images) {
      const dataUrl = img.image_url?.url;
      if (dataUrl) {
        const b64 = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
        if (b64) return Buffer.from(b64[1], 'base64');
      }
    }
  }

  const content = message.content;
  if (Array.isArray(content)) {
    for (const part of content) {
      if (part.type === 'image_url' && part.image_url?.url) {
        const b64 = part.image_url.url.match(/^data:image\/\w+;base64,(.+)$/);
        if (b64) return Buffer.from(b64[1], 'base64');
      }
    }
  }

  console.error('[debug] message keys:', Object.keys(message));
  throw new Error('No image data found in response');
}

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('Set OPENROUTER_API_KEY in the environment.');
    process.exit(1);
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  console.log(`Generating ${VARIANTS.length} images via ${MODEL}...\nOutput: ${OUTPUT_DIR}\n`);

  let ok = 0;
  for (const v of VARIANTS) {
    const outPath = join(OUTPUT_DIR, `${v.filename}.png`);
    console.log(`  [${v.palette}] Generating: ${v.filename}...`);
    try {
      const buf = await generateImage(apiKey, v.prompt);
      await writeFile(outPath, buf);
      console.log(`  done: ${v.filename}.png (${(buf.length / 1024).toFixed(0)} KB)`);
      ok++;
    } catch (err) {
      console.error(`  failed: ${v.filename} — ${err}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`\nDone! ${ok}/${VARIANTS.length} images generated.`);
  console.log(`Cost: ~$${(ok * 0.04).toFixed(2)}`);
}

main();
