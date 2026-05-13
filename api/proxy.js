export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, body } = req.body;

  try {
    if (type === 'hubspot_products') {
      const { offset = 0, limit = 100 } = body || {};
      const properties = [
        'name','price','description','hub','stage',
        'type','enterprise_only','process_step',
        'recurringbillingfrequency','hs_folder_name'
      ].join(',');

      const url = `https://api.hubapi.com/crm/v3/objects/products?limit=${limit}&after=${offset}&properties=${properties}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    }

    if (type === 'anthropic') {
      const apiKey = process.env.REACT_APP_ANTHROPIC_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'Anthropic API key not configured', content: [] });
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      // If Anthropic returned an error, surface it clearly
      if (!response.ok || data.error) {
        return res.status(200).json({
          content: [{ type: 'text', text: `API_ERROR: ${JSON.stringify(data.error || data)}` }]
        });
      }

      return res.status(200).json(data);
    }

    return res.status(400).json({ error: 'Unknown request type' });

  } catch (error) {
    return res.status(500).json({ 
      error: error.message,
      content: [{ type: 'text', text: `PROXY_ERROR: ${error.message}` }]
    });
  }
}
