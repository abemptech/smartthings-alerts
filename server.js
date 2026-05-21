import express from 'express';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.ST_CLIENT_ID;
const CLIENT_SECRET = process.env.ST_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

// Step 1: Start OAuth flow
app.get('/auth', (req, res) => {
  const authUrl = `https://api.smartthings.com/oauth/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=r:devices:*+r:locations:*`;
  res.redirect(authUrl);
});

// Step 2: Handle callback and exchange code for tokens
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
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, refresh_token } = response.data;

    res.send(`
      <h1>Success!</h1>
      <p><strong>Access Token:</strong> ${access_token}</p>
      <p><strong>Refresh Token:</strong> ${refresh_token}</p>
      <p>Copy the Refresh Token and add it as REFRESH_TOKEN in your Render cron job environment variables.</p>
    `);
  } catch (err) {
    res.send(`Error: ${err.message}`);
  }
});

app.get('/', (req, res) => {
  res.send('<a href="/auth">Click here to authorize SmartThings</a>');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
