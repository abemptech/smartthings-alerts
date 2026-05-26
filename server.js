import express from 'express';
import axios from 'axios';
import { createClient } from 'redis';

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.ST_CLIENT_ID;
const CLIENT_SECRET = process.env.ST_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

app.use(express.json());

async function getRedisClient() {
  const client = createClient({ url: process.env.REDIS_URL });
  await client.connect();
  return client;
}

// Check current token in Redis
app.get('/check-token', async (req, res) => {
  const client = await getRedisClient();
  const token = await client.get('refresh_token');
  await client.disconnect();
  res.send(`Current refresh token in Redis: ${token}`);
});

// Seed token into Redis
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
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`
        }
      }
    );

    // Save new refresh token to Redis
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

// Handle OAuth callback - auto seeds Redis with new refresh token
app.get('/callback', async (req, res) => {
  const { code } = req.query;

  try {
    const response = await axios.post(
      'https://api.smartthings.com/oauth/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`
        }
      }
    );

    const { access_token, refresh_token } = response.data;

    // Auto save to Redis
    const client = await getRedisClient();
    await client.set('refresh_token', refresh_token);
    await client.disconnect();

    res.send(`
      <h1>Success!</h1>
      <p><strong>Refresh Token saved to Redis automatically!</strong></p>
      <p>Access Token: ${access_token}</p>
      <p>Refresh Token: ${refresh_token}</p>
    `);
  } catch (err) {
    res.json({ error: err.message, details: err.response?.data });
  }
});

app.get('/auth', (req, res) => {
  const authUrl = `https://api.smartthings.com/oauth/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=r:devices:*+r:locations:*`;
  res.redirect(authUrl);
});

app.get('/', (req, res) => {
  res.send(`
    <h1>SmartThings OAuth Setup</h1>
    <p><a href="/auth">Authorize SmartThings (saves token to Redis automatically)</a></p>
    <p><a href="/check-token">Check current token in Redis</a></p>
    <p><a href="/test-token">Test token refresh</a></p>
  `);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
