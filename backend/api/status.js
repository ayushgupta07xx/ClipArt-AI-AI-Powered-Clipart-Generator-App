export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id required' });

  const apiToken = process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_KEY;
  if (!apiToken) return res.status(500).json({ error: 'Server misconfigured' });

  try {
    const response = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: { Authorization: `Token ${apiToken}` },
    });
    const prediction = await response.json();

    // Detect "no face" errors from the model — surface as a specific code
    // so the app can show a helpful message instead of a generic failure
    let error = prediction.error ?? null;
    if (error) {
      const lower = error.toLowerCase();
      if (
        lower.includes('no face') ||
        lower.includes('face not') ||
        lower.includes('face detection') ||
        lower.includes('cannot detect') ||
        lower.includes('could not detect') ||
        lower.includes('failed to detect')
      ) {
        error = 'NO_FACE_DETECTED';
      }
    }

    return res.status(200).json({
      status: prediction.status,
      output: prediction.output ?? null,
      error,
    });
  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}