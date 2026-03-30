export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    imageBase64,
    style,
    mimeType = 'image/jpeg',
    promptSuffix = '',
    strengthRatio,
  } = req.body || {};

  if (!imageBase64 || !style) return res.status(400).json({ error: 'Missing fields' });
  if (imageBase64.length > 2_500_000) return res.status(400).json({ error: 'Image too large.' });

  const apiToken = process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_KEY;
  if (!apiToken) return res.status(500).json({ error: 'REPLICATE_API_TOKEN not set' });

  const STYLE_MAP = {
    cartoon: {
      style: 'Toy',
      prompt: 'Disney Pixar 3D cartoon character, smooth rounded face, big expressive eyes, warm vibrant colors, soft cel shading, friendly animated look, studio lighting',
      negativePrompt: 'realistic, photo, sketch, flat, dark, ugly, deformed, blurry, low quality, grayscale',
      defaultStrength: 35,
    },
    flat: {
      style: 'Emoji',
      prompt: 'flat vector icon illustration, bold solid fill colors, clean geometric shapes, hard crisp edges, zero gradients, zero shadows, app icon style, 2D cutout, vibrant solid blocks of color',
      negativePrompt: 'realistic, 3D, shadow, gradient, shading, painterly, sketch, pencil, photo, blurry',
      defaultStrength: 20,
    },
    anime: {
      style: 'Video game',
      prompt: 'Japanese anime portrait, large detailed eyes with highlights, sharp clean linework, cel shaded skin, stylized hair with shine, vibrant saturated colors, studio ghibli quality',
      negativePrompt: 'realistic, western cartoon, 3D, ugly, deformed, blurry, low quality, photo',
      defaultStrength: 40,
    },
    pixel: {
      style: 'Pixels',
      prompt: '8-bit pixel art portrait, chunky square pixels, limited 16 color palette, retro video game sprite, sharp hard pixel edges, no anti-aliasing, NES SNES era style',
      negativePrompt: 'smooth, realistic, blurry, anti-aliased, high resolution, photo, 3D, painted',
      defaultStrength: 50,
    },
    sketch: {
      style: 'Clay',
      prompt: 'fine pencil sketch on white paper, detailed cross-hatching, graphite shading, hand drawn portrait, no color, pure black lines on white, monochrome, grayscale only',
      negativePrompt: 'color, colorful, painted, digital, smooth, realistic, 3D, cartoon, anime, blurry, clay, glossy',
      defaultStrength: 50,
    },
  };

  const config = STYLE_MAP[style];
  if (!config) return res.status(400).json({ error: `Invalid style: "${style}"` });

  // Map UI range (10-80) to model's valid range (15-50)
  let finalStrength = config.defaultStrength;
  if (typeof strengthRatio === 'number' && strengthRatio >= 10 && strengthRatio <= 80) {
    finalStrength = Math.round(15 + ((strengthRatio - 10) / 70) * 35);
  }

  const suffix = typeof promptSuffix === 'string' ? promptSuffix.trim().slice(0, 120) : '';
  const finalPrompt = suffix ? `${suffix}. ${suffix}, ${config.prompt}` : config.prompt;
  const instantIdStrength = suffix ? 0.5 : 0.8;
  const seed = suffix ? 42 : undefined;

  try {
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: 'a07f252abbbd832009640b27f063ea52d87d7a23a185ca165bec23b5adc8deaf',
        input: {
          image: `data:${mimeType};base64,${imageBase64}`,
          style: config.style,
          prompt: finalPrompt,
          negative_prompt: config.negativePrompt,
          num_steps: 20,
          style_strength_ratio: finalStrength,
          instant_id_strength: instantIdStrength,
          ...(seed !== undefined && { seed }),
          num_outputs: 1,
        },
      }),
    });

    const prediction = await response.json();
    if (!response.ok) {
      console.error('Replicate error:', JSON.stringify(prediction));
      const detail = prediction.detail || JSON.stringify(prediction);
      const isThrottle = detail.toLowerCase().includes('throttl') || detail.toLowerCase().includes('rate limit');
      return res.status(isThrottle ? 429 : 502).json({ error: detail });
    }

    return res.status(200).json({ id: prediction.id, status: prediction.status });
  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ error: String(err) });
  }
}
