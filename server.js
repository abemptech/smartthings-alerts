import express from 'express';
import axios from 'axios';
import { createClient } from 'redis';

const app = express();
const PORT = process.env.PORT || 3000;

const REDIRECT_URI = process.env.REDIRECT_URI;

const APPS = {
  '1': { clientId: process.env.ST_CLIENT_ID, clientSecret: process.env.ST_CLIENT_SECRET },
  '2': { clientId: process.env.ST_CLIENT_ID_2, clientSecret: process.env.ST_CLIENT_SECRET_2 },
  '3': { clientId: process.env.ST_CLIENT_ID_3, clientSecret: process.env.ST_CLIENT_SECRET_3 },
  '4': { clientId: process.env.ST_CLIENT_ID_4, clientSecret: process.env.ST_CLIENT_SECRET_4 }.
 'GV': { clientId: process.env.ST_CLIENT_ID_GV, clientSecret: process.env.ST_CLIENT_SECRET_GV }
};

app.use(express.json());

async function getRedisClient() {
  const client = createClient({ url: process.env.REDIS_URL });
  await client.connect();
  return client;
}

// List apps for a given token
app.get('/list-apps', async (req, res) => {
  const token = req.query.token || process.env.TEMP_PAT;
  try {
    const response = await axios.get(
      'https://api.smartthings.com/v1/apps',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    res.json(response.data);
  } catch (err) {
    res.json({ error: err.message, details: err.response?.data });
  }
});

// Regenerate OAuth credentials for an app
app.get('/regenerate-oauth/:appId', async (req, res) => {
  const { appId } = req.params;
  const token = req.query.token || process.env.TEMP_PAT;
  try {
    const response = await axios.post(
      `https://api.smartthings.com/v1/apps/${appId}/oauth/generate`,
      {
        clientName: 'ST Monitor Greenview',
        scope: ['r:devices:*', 'r:locations:*']
      },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    res.json(response.data);
  } catch (err) {
    res.json({ error: err.message, details: err.response?.data });
  }
});

// Update app OAuth settings
app.get('/update-app/:appId/:appNum', async (req, res) => {
  const { appId, appNum } = req.params;
  const token = req.query.token || process.env.TEMP_PAT;
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
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    res.json(response.data);
  } catch (err) {
    res.json({ error: err.message, details: err.response?.data });
  }
});
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
      <a href="/auth?app=3" style="font-size:20px;padding:10px;background:purple;color:white;text-decoration:none;border-radius:5px;margin-right:10px;">Switch to App 3</a>
      <a href="/auth?app=4" style="font-size:20px;padding:10px;background:orange;color:white;text-decoration:none;border-radius:5px;">Switch to App 4</a>
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

// Check authorized locations with names
app.get('/check-authorized', async (req, res) => {
  const client = await getRedisClient();
  const keys = await client.keys('refresh_token:*');
  const authorizedIds = keys.map(k => k.replace('refresh_token:', ''));
  await client.disconnect();

  const LOCATIONS = [
    { id: '4837b924-2210-4dc4-83b7-9a4c0364f810', name: '25A Grand' },
    { id: 'a24ea1c2-73d3-4f48-8a56-69a8162907ed', name: '25B-Grand' },
    { id: 'f6276e7a-343f-494e-8c0b-7dc1b7303127', name: '27A Grand' },
    { id: 'ff90c913-2631-4f61-bd0f-57c504cd4146', name: '31A Grand' },
    { id: 'ab46efea-5c37-4516-8eb7-5d76ddabfaf6', name: '29 C Grand' },
    { id: '57e30a74-286f-4020-85e3-b3cb940157d2', name: 'Beckerle' },
    { id: 'bb800a5b-394a-467a-bab8-8ad0445d054d', name: 'Beecher' },
    { id: '52fe184e-f00c-43a6-bf5e-83364e780077', name: 'Bethel Innovation Lab' },
    { id: 'cb4a3774-7b2e-4481-a8e9-0a59004d52fc', name: 'Blackman' },
    { id: '94ac1a0f-78ca-44bc-85f6-2a23a7509367', name: 'Burke CT' },
    { id: 'bb6745cf-de29-4c73-9492-ae5119f016ea', name: 'Carp1' },
    { id: 'f9c658d7-d211-4006-8cf2-5507cbd0f367', name: 'Carp2' },
    { id: '0411cf00-fdcf-4d37-a4ed-b62757ef6c4c', name: 'Carp3' },
    { id: 'e5390bfe-b369-41f2-b218-aaafbbbf8907', name: 'Carp4' },
    { id: 'eb508ff8-02ad-4337-9853-c5a90b8ddf9f', name: 'Carmel' },
    { id: 'a9f82d24-0124-4bca-b45b-33006e5b2c60', name: 'CCA' },
    { id: 'aea24347-f2eb-4011-8e24-e4f00032b9f8', name: 'Cleveland Unit 1' },
    { id: '6b6cd665-6830-4fa5-9e86-5c4186423cf5', name: 'Cleveland Unit 3' },
    { id: '727324c5-231b-4e35-8253-deca7059db1d', name: 'Corbin' },
    { id: '58e121db-b978-469d-b113-59112a5bf7cd', name: 'Cornell tester 2024' },
    { id: '3e1494a5-a6e7-4f28-b192-722b3ce56297', name: 'Crows Nest 4K' },
    { id: 'f9153f09-099b-4dee-b3c7-8bacff45be15', name: 'Dodgingtown' },
    { id: '63b4aa1b-0713-467d-9e26-71cf674ca702', name: 'Dorset' },
    { id: '75f02cd8-3bc8-4eff-ae57-d29a1a28d927', name: 'Foley' },
    { id: '271f9430-cd73-48e3-bcdd-6d17f72040a3', name: 'Howland' },
    { id: '24134771-f055-4c4a-ba65-1d81a4a60457', name: 'Hubbard' },
    { id: '3ed81f22-79d6-456d-a7d6-d1983a6fe8cf', name: 'Kelley ST Hub' },
    { id: 'b78594ec-32a4-4274-bcf1-33ef521b1355', name: 'Liberty 13' },
    { id: '3d9916e8-eb9c-42c0-8164-6c1ca8012394', name: 'Liberty 2' },
    { id: 'c2238096-4889-43ea-a126-8a8e3a5f0149', name: 'Maple' },
    { id: 'c6419b60-4873-4a20-b075-14dcb6c94c93', name: 'Millington' },
    { id: 'cd3b29cf-f425-42db-ab3d-ddfde4a7f6f6', name: 'Mountaindale' },
    { id: '21e2579a-1e2e-4f29-a658-2955699f31ab', name: 'Mountainville' },
    { id: '0de01d66-b1b6-480b-8a90-3a0a4f25acc2', name: 'NPR' },
    { id: 'f10a62c3-f71a-4cbf-872d-2f815a462be4', name: 'Norwalk Office' },
    { id: '11a23d0a-8e0e-4dcf-91a1-efb76d1465ef', name: 'Old Hawleyville' },
    { id: 'f4d1e085-87b1-4d96-97e3-01e5f536d44f', name: 'PoundSweet Hub' },
    { id: '7265e928-7940-412d-b9a6-6dfd88d32081', name: 'PRC' },
    { id: '16bd4aae-c943-4126-a90b-77350e30a882', name: 'Ridge Road' },
    { id: '81af92a1-dad1-43d9-91a3-227578218c55', name: 'Ritch Drive' },
    { id: '98c19af9-71c2-4ea2-a37c-952497db5253', name: 'Saw Mill' },
    { id: 'bb0cf14f-0cee-4974-be69-91935cfe4f93', name: 'Seminole' },
    { id: 'eaf0b7fb-d07a-423d-a27e-4c4b187fbab2', name: 'Shep 25-6' },
    { id: '10e0e6b5-5253-49a6-9d77-f9daed7aa3ca', name: 'Shep 9-2' },
    { id: '805b9a63-33af-4aaf-bc7e-e3631888b114', name: 'Sheffield 1' },
    { id: '6e5934fe-fba5-4f7a-84ed-c6bf5bde5215', name: 'Sheffield 2' },
    { id: 'e059dac6-5d5e-4497-8372-c6350776d401', name: 'Sunrise' },
    { id: 'aa5e3f20-612c-44ed-b414-fe00edbfa561', name: 'Sweetcake' },
    { id: 'b7e50bb8-df96-4015-a930-40243326d060', name: 'Tamanny' },
    { id: 'efd2bb0c-8d5c-4246-b27f-d9ba8cd0407e', name: 'Unionville' },
    { id: '22a944c9-9e6c-4032-a0f7-eb34ebd7bab5', name: 'Waterbury' },
    { id: 'd09cff4f-af93-44bb-bf39-f1df5d8cefa3', name: 'Well Ave' },
    { id: '961d870d-872d-4c48-bd9b-0ba7ea712f16', name: 'West St - NY' },
    { id: '42081546-67b6-49ca-9d7c-3d278f1a8175', name: 'West ST CT' },
    { id: '5ad318df-efe5-4f0b-b3e4-e3a5cdd339c3', name: 'Whippoorwill Hub' },
    { id: '28bdd455-4694-44f8-b337-c085fd5af99c', name: 'Woodland' },
    { id: '9d6b8309-ebd6-407c-81f8-5430df3e2a4c', name: 'Starr Unit 1' },
    { id: 'c77c11e7-53be-4693-92e8-8ef0985b5673', name: 'Starr 2' },
  ];

  const authorized = LOCATIONS.filter(l => authorizedIds.includes(l.id));
  const notAuthorized = LOCATIONS.filter(l => !authorizedIds.includes(l.id));

  res.send(`
    <h1>Authorization Status</h1>
    <h2>✅ Authorized (${authorized.length})</h2>
    <ul>${authorized.map(l => `<li>${l.name}</li>`).join('')}</ul>
    <h2>❌ Not Yet Authorized (${notAuthorized.length})</h2>
    <ul>${notAuthorized.map(l => `<li>${l.name}</li>`).join('')}</ul>
  `);
});

app.get('/', (req, res) => {
  res.send(`
    <h1>SmartThings OAuth Setup</h1>
    <p><a href="/auth?app=1">Authorize with App 1 (full)</a></p>
    <p><a href="/auth?app=2">Authorize with App 2</a></p>
    <p><a href="/auth?app=3">Authorize with App 3</a></p>
    <p><a href="/auth?app=4">Authorize with App 4</a></p>
    <p><a href="/check-authorized">Check authorized locations</a></p>
    <p><a href="/check-tokens">Check all tokens in Redis</a></p>
  `);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
