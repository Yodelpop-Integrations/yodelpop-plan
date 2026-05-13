export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, body } = req.body;

  try {
    // ── HubSpot: fetch products ───────────────────────────────────────────
    if (type === 'hubspot_products') {
      const { offset = 0, limit = 100 } = body || {};
      const properties = [
        'name','price','description','hub','stage',
        'type','enterprise_only','process_step',
        'recurringbillingfrequency','hs_folder_name'
      ].join(',');
      const url = `https://api.hubapi.com/crm/v3/objects/products?limit=${limit}&after=${offset}&properties=${properties}`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`, 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    }

    // ── HubSpot: create object (deal, line item) ──────────────────────────
    if (type === 'hubspot_create') {
      const { objectType, properties, associations } = body || {};
      const payload = { properties };
      if (associations) payload.associations = associations;

      const response = await fetch(`https://api.hubapi.com/crm/v3/objects/${objectType}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    }

    // ── Anthropic Claude ──────────────────────────────────────────────────
    if (type === 'anthropic') {
      const apiKey = process.env.REACT_APP_ANTHROPIC_API_KEY;
      if (!apiKey) {
        return res.status(200).json({
          content: [{ type: 'text', text: 'API_ERROR: Anthropic API key not configured' }]
        });
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
