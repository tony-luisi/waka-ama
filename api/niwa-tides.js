export default async function handler(req, res) {
  console.log('=== NIWA API PROXY START ===');
  console.log('Request method:', req.method);
  console.log('Request URL:', req.url);
  console.log('Raw query string:', req.url?.split('?')[1] || 'none');
  
  // Enable CORS for frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    console.log('OPTIONS request handled');
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    console.log('Non-GET method rejected:', req.method);
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    console.log('=== PARAMETER EXTRACTION ===');
    console.log('req.query object:', JSON.stringify(req.query, null, 2));
    console.log('req.query keys:', Object.keys(req.query));
    console.log('req.query values:', Object.values(req.query));
    
    // Check all possible parameter variations
    console.log('Parameter check:');
    console.log('- lat exists:', 'lat' in req.query, '- value:', req.query.lat);
    console.log('- long exists:', 'long' in req.query, '- value:', req.query.long);
    console.log('- lng exists:', 'lng' in req.query, '- value:', req.query.lng);
    console.log('- startDate exists:', 'startDate' in req.query, '- value:', req.query.startDate);
    
    const { lat, long, startDate, numberOfDays, interval, datum } = req.query;
    console.log('Destructured parameters:', { lat, long, startDate, numberOfDays, interval, datum });

    console.log('=== VALIDATION ===');
    console.log('lat validation:', !lat ? 'MISSING' : 'OK', '- value:', lat);
    console.log('long validation:', !long ? 'MISSING' : 'OK', '- value:', long);
    console.log('startDate validation:', !startDate ? 'MISSING' : 'OK', '- value:', startDate);
    
    if (!lat || !long || !startDate) {
      console.error('=== VALIDATION FAILED ===');
      console.error('Missing required parameters:', { lat, long, startDate });
      console.error('Returning 400 error to client');
      res.status(400).json({ error: 'Missing required parameters: lat, long, startDate' });
      return;
    }

    console.log('=== ENVIRONMENT CHECK ===');
    const apiKey = process.env.NIWA_API_KEY;
    console.log('API key configured:', !!apiKey);
    console.log('API key length:', apiKey ? apiKey.length : 0);
    console.log('API key first 8 chars:', apiKey ? apiKey.substring(0, 8) + '...' : 'none');
    
    if (!apiKey) {
      console.error('=== API KEY MISSING ===');
      console.error('NIWA_API_KEY environment variable not set');
      console.error('Available env vars:', Object.keys(process.env).filter(k => k.includes('NIWA')));
      res.status(500).json({ error: 'NIWA API key not configured' });
      return;
    }

    console.log('=== BUILDING NIWA REQUEST ===');
    const params = new URLSearchParams({
      lat: lat.toString(),
      long: long.toString(),
      startDate,
      numberOfDays: numberOfDays || '1',
      ...(interval && { interval }),
      datum: datum || 'MSL'
    });

    const url = `https://api.niwa.co.nz/tides/data?${params}`;
    console.log('Final NIWA API URL:', url);
    console.log('Request headers to be sent:', {
      'x-apikey': apiKey ? apiKey.substring(0, 8) + '...' : 'none',
      'Accept': 'application/json'
    });
    
    console.log('=== MAKING NIWA API CALL ===');
    const response = await fetch(url, {
      headers: {
        'x-apikey': apiKey,
        'Accept': 'application/json'
      }
    });

    console.log('=== NIWA API RESPONSE ===');
    console.log('Response status:', response.status);
    console.log('Response status text:', response.statusText);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      console.error('=== NIWA API ERROR ===');
      const errorText = await response.text();
      console.error(`NIWA API error ${response.status}:`, errorText);
      console.error('Our request URL was:', url);
      console.error('Our request headers were:', {
        'x-apikey': apiKey ? `${apiKey.substring(0, 8)}...` : 'undefined',
        'Accept': 'application/json'
      });
      throw new Error(`NIWA API error: ${response.status}`);
    }

    console.log('=== NIWA API SUCCESS ===');
    const data = await response.json();
    console.log('Response data structure:', {
      hasMetadata: !!data.metadata,
      hasValues: !!data.values,
      valueCount: data.values?.length,
      firstValue: data.values?.[0],
      lastValue: data.values?.[data.values?.length - 1]
    });
    console.log('Returning success response to client');
    console.log('=== NIWA API PROXY END (SUCCESS) ===');
    res.status(200).json(data);

  } catch (error) {
    console.error('=== NIWA API PROXY ERROR ===');
    console.error('Error type:', typeof error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('=== NIWA API PROXY END (ERROR) ===');
    res.status(500).json({ 
      error: 'Failed to fetch tide data',
      message: error.message 
    });
  }
}