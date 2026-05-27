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
  '4': { clientId: process.env.ST_CLIENT_ID_4, clientSecret: process.env.ST_CLIENT_SECRET_4 }
};


app.use(express.json());

async function getRedisClient() {
  const client = createClient({ url: process.env.REDIS_URL });
  await client.connect();
  return client;
}

// Update app OAuth settings
app.get('/update-app/:appId/:appNum', async (req, res) => {
  const { appId, appNum } = req.params;
  const TEMP_PAT = process.env.TEMP_PAT;
  const appCreds = APPS[appNum];
  try {
    const response = await axios.put(
      `https://api.smartthings.com/v1/apps/${appId}/oauth`,
      {
        clientName: `ST Monitor ${appNum}`,
        scope: ['r:devices:*', 'r:locations:*'],
        redirectUris: ['https://smartthings-oauth.onrender.com/callback']
      },
      {
headers: {
  Authorization: `Bearer ${process.env.TEMP_PAT}`,
  'Content-Type': 'application/json'
}
      }
    );
    res.json(response.data);
  } catch (err) {
    res.json({ error: err.message, details: err.response?.data });
  }
});

// Check app details
app.get('/check-app/:appId', async (req, res) => {
  const { appId } = req.params;
  const TEMP_PAT = process.env.TEMP_PAT;
  try {
    const response = await axios.get(
      `https://api.smartthings.com/v1/apps/${appId}`,
      { headers: { Authorization: `Bearer ${TEMP_PAT}` } }
    );
    res.json(response.data);
  } catch (err) {
    res.json({ error: err.message, details: err.response?.data });
  }
});

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

// Check single token
app.get('/check-token', async (req, res) => {
  const client = await getRedisClient();
  const token = await client.get('refresh_token');
  await client.disconnect();
  res.send(`Current refresh token in Redis: ${token}`);
});

// Seed token into Redis manually
app.get('/seed-token', async (req, res) => {
  const token = req.query.token;
  if (!token) {
    return res.send('Please provide a token: /seed-token?token=YOUR_TOKEN');
  }
  const client = await getRedisClient();
  await client.set('refresh_token', token);
  await client.disconnect();
  res.send(`Refresh token stored in Redis: ${token.substring(0, 8)}...`);
});

// Test token refresh using Redis
app.get('/test-token', async (req, res) => {
  try {
    const client = await getRedisClient();
    const refreshToken = await client.get('refresh_token');
    await client.disconnect();

    const response = await axios.post(
      'https://api.smartthings.com/oauth/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.ST_CLIENT_ID,
        client_secret: process.env.ST_CLIENT_SECRET
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${process.env.ST_CLIENT_ID}:${process.env.ST_CLIENT_SECRET}`).toString('base64')}`
        }
      }
    );

    const client2 = await getRedisClient();
    await client2.set('refresh_token', response.data.refresh_token);
    await client2.disconnect();

    res.json({ success: true, access_token: response.data.access_token });
  } catch (err) {
    res.json({ error: err.message, details: err.response?.data });
  }
});

// Create OAuth app
app.get('/create-app', async (req, res) => {
  const TEMP_PAT = process.env.TEMP_PAT;
  try {
    const response = await axios.post(
      'https://api.smartthings.com/v1/apps',
      {
        appName: 'st-battery-monitor',
        displayName: 'ST Battery Monitor',
        description: 'Battery and offline monitoring',
        appType: 'API_ONLY',
        classifications: ['AUTOMATION'],
        apiOnly: {
          subscription: {
            targetUrl: REDIRECT_URI
          }
        },
        oauth: {
          clientName: 'ST Battery Monitor',
          scope: ['r:devices:*', 'r:locations:*', 'r:deviceprofiles:*'],
          redirectUris: [REDIRECT_URI]
        }
      },
      {
        headers: {
          Authorization: `Bearer ${TEMP_PAT}`,
          'Content-Type': 'application/json'
        }
      }
    );
    res.json(response.data);
  } catch (err) {
    res.json({ error: err.message, details: err.response?.data });
  }
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

    const locationsResponse = await axios.get(
      'https://api.smartthings.com/v1/locations',
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    const locations = locationsResponse.data.items;

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
    <p><a href="/check-app/8a15fcc1-d53e-4c44-8100-b6a94bbff086">Check App 2 details</a></p>
    <p><a href="/check-app/bfac25ff-9b38-437b-b1b9-1b3916c33f29">Check App 3 details</a></p>
    <p><a href="/update-app/8a15fcc1-d53e-4c44-8100-b6a94bbff086/2">Update App 2 redirect URI</a></p>
    <p><a href="/update-app/bfac25ff-9b38-437b-b1b9-1b3916c33f29/3">Update App 3 redirect URI</a></p>
  `);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
