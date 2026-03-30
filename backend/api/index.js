export default function handler(req, res) {
  res.status(200).json({
    status: 'ok',
    message: 'Clipart AI backend is running',
    endpoints: {
      generate: 'POST /api/generate',
      status: 'GET /api/status?id=<prediction_id>',
    },
  });
}