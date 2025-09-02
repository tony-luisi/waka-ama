export default async function handler(req, res) {
  // Enable CORS for frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    console.log('NIWA API proxy called with query:', req.query);
    
    const { lat, lng, startDate, numberOfDays, interval, datum } = req.query;

    if (!lat || !lng || !startDate) {
      console.error('Missing required parameters:', { lat, lng, startDate });
      res.status(400).json({ error: 'Missing required parameters: lat, lng, startDate' });
      return;
    }

    const apiKey = process.env.NIWA_API_KEY;
    console.log('API key configured:', !!apiKey);
    if (!apiKey) {
      console.error('NIWA_API_KEY environment variable not set');
      res.status(500).json({ error: 'NIWA API key not configured' });
      return;
    }

    const params = new URLSearchParams({
      lat: lat.toString(),
      long: lng.toString(),
      startDate,
      numberOfDays: numberOfDays || '1',
      ...(interval && { interval }),
      datum: datum || 'MSL'
    });

    const url = `https://forecast-v2.metservice.com/niwa/tide/data?${params}`;
    console.log('Making request to NIWA API:', url);
    
    const response = await fetch(url, {
      headers: {
        'x-apikey': apiKey,
        'Accept': 'application/json'
      }
    });

    console.log('NIWA API response status:', response.status);
    console.log('NIWA API response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`NIWA API error ${response.status}:`, errorText);
      console.error('Request headers sent:', {
        'x-apikey': apiKey ? `${apiKey.substring(0, 8)}...` : 'undefined',
        'Accept': 'application/json'
      });
      throw new Error(`NIWA API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('NIWA API response data structure:', {
      hasMetadata: !!data.metadata,
      hasValues: !!data.values,
      valueCount: data.values?.length,
      firstValue: data.values?.[0]
    });
    res.status(200).json(data);

  } catch (error) {
    console.error('NIWA API proxy error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch tide data',
      message: error.message 
    });
  }
}