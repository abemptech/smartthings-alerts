import express from 'express';
import axios from 'axios';
import { createClient } from 'redis';

const app = express();
const PORT = process.env.PORT || 3000;

const REDIRECT_URI = process.env.REDIRECT_URI;

const APPS = {
  '1': { clientId: process.env.ST_CLIENT_ID, clientSecret: process.env.ST_CLIENT_SECRET },
  '2': { clientId: process.env.ST_CLIENT_ID_2, clientSecret: process.env.ST_CLIENT_SECRET_2 },
  '3': { clientId: process.env.ST_CLIENT_ID_3, clientSecret: process.env.ST_CLIENT_SECRET_3 }
};

app.use(express.json());

async function getRedisClient() {
  const client = createClient({ url: process.env.REDIS_URL });
  await client.connect();
  return client;
}

// Check all tokens in Redis
app.get('/check-tokens', async (req, res) => {
  const client = await getRedisClient();
  const keys = await client.keys('refresh_token:*');
  const results = {};
  for (const key of keys) {
    const token = await client.get(key);
    results[key] = token?.substring(0, 8) + '...';
  }
  await client.disconnect();
  res.json({ count: keys.length, tokens: results });
});

// Handle OAuth callback
app.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  const appNum = state || '1';
  const appCreds = APPS[appNum];

  if (!appCreds) {
    return res.send('Invalid app number in state parameter');
  }

  try {
    const response = await axios.post(
      'https://api.smartthings.com/oauth/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: appCreds.clientId,
        client_secret: appCreds.clientSecret,
        redirect_uri: REDIRECT_URI
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${appCreds.clientId}:${appCreds.clientSecret}`).toString('base64')}`
        }
      }
    );

    const { access_token, refresh_token } = response.data;

    // Find out which location this token has access to
    const locationsResponse = await axios.get(
      'https://api.smartthings.com/v1/locations',
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    const locations = locationsResponse.data.items;

    // Store refresh token and app number keyed by location ID in Redis
    const client = await getRedisClient();
    for (const location of locations) {
      await client.set(`refresh_token:${location.locationId}`, refresh_token);
      await client.set(`app_num:${location.locationId}`, appNum);
    }
    await client.disconnect();

    res.send(`
      <h1>Success! (App ${appNum})</h1>
      <p><strong>Locations authorized (${locations.length}):</strong></p>
      <ul>${locations.map(l => `<li>${l.name} (${l.locationId})</li>`).join('')}</ul>
      <p>Refresh token stored in Redis for each location above.</p>
      <br>
      <a href="/auth?app=${appNum}" style="font-size:20px;padding:10px;background:green;color:white;text-decoration:none;border-radius:5px;margin-right:10px;">Authorize Another with App ${appNum}</a>
      <a href="/auth?app=2" style="font-size:20px;padding:10px;background:blue;color:white;text-decoration:none;border-radius:5px;margin-right:10px;">Switch to App 2</a>
      <a href="/auth?app=3" style="font-size:20px;padding:10px;background:purple;color:white;text-decoration:none;border-radius:5px;">Switch to App 3</a>
    `);
  } catch (err) {
    res.json({ error: err.message, details: err.response?.data });
  }
});

app.get('/auth', (req, res) => {
  const appNum = req.query.app || '1';
  const appCreds = APPS[appNum];

  if (!appCreds) {
    return res.send('Invalid app number');
  }

  const authUrl = `https://api.smartthings.com/oauth/authorize?response_type=code&client_id=${appCreds.clientId}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=r:devices:*+r:locations:*&state=${appNum}`;
  res.redirect(authUrl);
});

app.get('/', (req, res) => {
  res.send(`
    <h1>SmartThings OAuth Setup</h1>
    <p><a href="/auth?app=1">Authorize with App 1 (locations 1-20)</a></p>
    <p><a href="/auth?app=2">Authorize with App 2 (locations 21-40)</a></p>
    <p><a href="/auth?app=3">Authorize with App 3 (locations 41-57)</a></p>
    <p><a href="/check-tokens">Check all authorized locations</a></p>
  `);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
