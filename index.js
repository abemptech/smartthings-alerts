import axios from 'axios';
import nodemailer from 'nodemailer';
import { createClient } from 'redis';

const ST_CLIENT_ID = process.env.ST_CLIENT_ID;
const ST_CLIENT_SECRET = process.env.ST_CLIENT_SECRET;
const ST_CLIENT_ID_2 = process.env.ST_CLIENT_ID_2;
const ST_CLIENT_SECRET_2 = process.env.ST_CLIENT_SECRET_2;
const ST_CLIENT_ID_3 = process.env.ST_CLIENT_ID_3;
const ST_CLIENT_SECRET_3 = process.env.ST_CLIENT_SECRET_3;
const ALERT_EMAIL = process.env.ALERT_EMAIL;
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const BATTERY_THRESHOLD = 26;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
  { id: '3a4b4d2f-a8c2-499d-b596-b262185f1170', name: 'Greenview' },
];

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD
  }
});

async function getAccessToken(redisClient, locationId) {
  const refreshToken = await redisClient.get(`refresh_token:${locationId}`);
  const appNum = await redisClient.get(`app_num:${locationId}`) || '1';

  if (!refreshToken) {
    console.log(`No refresh token found for location ${locationId} — skipping`);
    return null;
  }

  const clientId = appNum === '2' ? ST_CLIENT_ID_2 :
                   appNum === '3' ? ST_CLIENT_ID_3 :
                   ST_CLIENT_ID;
  const clientSecret = appNum === '2' ? ST_CLIENT_SECRET_2 :
                       appNum === '3' ? ST_CLIENT_SECRET_3 :
                       ST_CLIENT_SECRET;

  console.log(`Using app ${appNum} for location ${locationId}: ${refreshToken.substring(0, 8)}...`);

  const response = await axios.post(
    'https://api.smartthings.com/oauth/token',
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
      }
    }
  );

  const newRefreshToken = response.data.refresh_token;
  await redisClient.set(`refresh_token:${locationId}`, newRefreshToken);
  console.log(`New refresh token saved for location ${locationId}`);

  return response.data.access_token;
}

async function sendEmail(subject, body) {
  console.log(`Sending email: ${subject}`);
  await transporter.sendMail({
    from: GMAIL_USER,
    to: ALERT_EMAIL,
    subject,
    text: body
  });
  console.log(`Email sent: ${subject}`);
}

async function checkLocation(location, redisClient) {
  console.log(`Checking location: ${location.name}`);

  let accessToken;
  try {
    accessToken = await getAccessToken(redisClient, location.id);
  } catch (err) {
    console.log(`Failed to get token for ${location.name}: ${err.message}`);
    return;
  }

  if (!accessToken) return;

  let devices;
  try {
    const devicesResponse = await axios.get(
      'https://api.smartthings.com/v1/devices',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { locationId: location.id }
      }
    );
    devices = devicesResponse.data.items;
    console.log(`Found ${devices.length} devices at ${location.name}`);
  } catch (err) {
    console.log(`Failed to get devices for ${location.name}: ${err.message}`);
    return;
  }

  const lowBatteryDevices = [];
  const offlineDevices = [];
  const offlineHubs = [];

  for (const device of devices) {
    await sleep(500);

    try {
      const healthResponse = await axios.get(
        `https://api.smartthings.com/v1/devices/${device.deviceId}/health`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const state = healthResponse.data.state;
      const lastUpdated = new Date(healthResponse.data.lastUpdatedDate).toLocaleString();

      if (state === 'OFFLINE') {
        if (device.type === 'HUB') {
          console.log(`Hub offline: ${device.label} at ${location.name}`);
          offlineHubs.push({ name: device.label, since: lastUpdated });
        } else {
          console.log(`Device offline: ${device.label} at ${location.name}`);
          offlineDevices.push({ name: device.label, since: lastUpdated });
        }
      }

      const hasBattery = device.components?.[0]?.capabilities?.some(c => c.id === 'battery');
      if (hasBattery) {
        await sleep(500);
        const statusResponse = await axios.get(
          `https://api.smartthings.com/v1/devices/${device.deviceId}/status`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const batteryValue = statusResponse.data.components?.main?.battery?.battery?.value;
        if (batteryValue !== null && batteryValue !== undefined && batteryValue < BATTERY_THRESHOLD) {
          console.log(`Low battery: ${device.label} at ${location.name}: ${batteryValue}%`);
          lowBatteryDevices.push({ name: device.label, battery: batteryValue });
        }
      }

    } catch (err) {
      console.log(`Error checking ${device.label}: ${err.message}`);
    }
  }

  for (const hub of offlineHubs) {
    await sendEmail(
      `URGENT - Hub Offline — ${location.name}`,
      `Hub: ${hub.name}\nLocation: ${location.name}\nOffline Since: ${hub.since}\nStatus: OFFLINE\n\nThis hub being offline may affect all devices at this location.\nPlease check immediately.`
    );
  }

  if (offlineDevices.length > 0) {
    await sendEmail(
      `SmartThings - Devices Offline — ${location.name}`,
      `The following devices are offline at ${location.name}:\n\n${offlineDevices.map(d => `• ${d.name} (since ${d.since})`).join('\n')}\n\nPlease check these devices.`
    );
  }

  if (lowBatteryDevices.length > 0) {
    await sendEmail(
      `SmartThings - Low Battery Alert — ${location.name}`,
      `The following devices have low battery at ${location.name}:\n\n${lowBatteryDevices.map(d => `• ${d.name}: ${d.battery}%`).join('\n')}\n\nPlease replace the batteries.`
    );
  }
}

async function main() {
  console.log('Starting SmartThings alerts check...');

  const redisClient = createClient({ url: process.env.REDIS_URL });
  await redisClient.connect();

  try {
    for (const location of LOCATIONS) {
      await checkLocation(location, redisClient);
      await sleep(1000);
    }
  } catch (err) {
    console.error('Unexpected error:', err.message);
    try {
      await sendEmail(
        'SmartThings Alert - Unexpected Error',
        `An unexpected error occurred: ${err.message}`
      );
    } catch (emailErr) {
      console.error('Failed to send error email:', emailErr.message);
    }
  } finally {
    await redisClient.disconnect();
  }

  console.log('Done.');
}

main().catch(console.error);
