export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageUrl } = req.body || {};
  if (!imageUrl) return res.status(400).json({ error: 'Missing imageUrl' });

  const apiKey = process.env.REMOVE_BG_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'REMOVE_BG_API_KEY not set' });

  try {
    // Download the generated image from Replicate
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) return res.status(502).json({ error: 'Could not fetch source image' });
    const buffer = await imageRes.arrayBuffer();

    // Send to remove.bg — synchronous, no polling needed
    const formData = new FormData();
    formData.append('image_file', new Blob([buffer], { type: 'image/jpeg' }), 'image.jpg');
    formData.append('size', 'auto');

    const bgRes = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': apiKey },
      body: formData,
    });

    if (!bgRes.ok) {
      const errText = await bgRes.text();
      console.error('remove.bg error:', bgRes.status, errText);
      if (bgRes.status === 402) {
        return res.status(402).json({ error: 'QUOTA_EXCEEDED' });
      }
      return res.status(502).json({ error: `remove.bg error: ${bgRes.status}` });
    }

    // Returns PNG bytes directly — convert to base64 data URI
    const resultBuffer = await bgRes.arrayBuffer();
    const base64 = Buffer.from(resultBuffer).toString('base64');
    return res.status(200).json({ url: `data:image/png;base64,${base64}` });

  } catch (err) {
    console.error('removebg exception:', err);
    return res.status(500).json({ error: String(err) });
  }
}
