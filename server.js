import express from 'express';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.ST_CLIENT_ID;
const CLIENT_SECRET = process.env.ST_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

app.use(express.json());

// Test token refresh
app.get('/test-token', async (req, res) => {
  const REFRESH_TOKEN = process.env.REFRESH_TOKEN;

  try {
    const response = await axios.post(
      'https://api.smartthings.com/oauth/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: REFRESH_TOKEN,
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
    res.send(`
      <h1>Success!</h1>
      <p><strong>Access Token:</strong> ${access_token}</p>
      <p><strong>Refresh Token:</strong> ${refresh_token}</p>
      <p>Copy the Refresh Token and add it as REFRESH_TOKEN in your Render cron job environment variables.</p>
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
    <p><a href="/create-app">Step 1: Create OAuth App</a></p>
    <p><a href="/auth">Step 2: Authorize (after adding Client ID to env vars)</a></p>
    <p><a href="/test-token">Test Token Refresh</a></p>
  `);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
