export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, body } = req.body;

  try {
    // HubSpot products fetch
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

    // Anthropic Claude call
    if (type === 'anthropic') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.REACT_APP_ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    }

    return res.status(400).json({ error: 'Unknown request type' });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
