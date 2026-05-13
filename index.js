import axios from 'axios';
import nodemailer from 'nodemailer';

const PAT_TOKEN = 'b7a5d14d-5bcd-4121-8501-e69ca43be769';
const ALERT_EMAIL = 'laurie.dale@abilitybeyond.org';
const GMAIL_USER = 'abemptech@gmail.com';
const GMAIL_APP_PASSWORD = 'Spr!ng2020';
const BATTERY_THRESHOLD = 20;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Location IDs to monitor
const LOCATIONS = [
  { id: 'bb800a5b-394a-467a-bab8-8ad0445d054d', name: 'Beecher' },
  { id: '63b4aa1b-0713-467d-9e26-71cf674ca702', name: 'Dorset' },
  // add all 75 locations here
];

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD
  }
});

async function sendEmail(subject, body) {
  await transporter.sendMail({
    from: GMAIL_USER,
    to: ALERT_EMAIL,
    subject,
    text: body
  });
}

async function checkLocation(location) {
  console.log(`Checking location: ${location.name}`);

  // Get all devices at this location
  const devicesResponse = await axios.get(
    'https://api.smartthings.com/v1/devices',
    {
      headers: { Authorization: `Bearer ${PAT_TOKEN}` },
      params: { locationId: location.id }
    }
  );

  const devices = devicesResponse.data.items;
  const lowBatteryDevices = [];
  const offlineDevices = [];
  const offlineHubs = [];

  for (const device of devices) {
    await sleep(500);

    try {
      // Check health
      const healthResponse = await axios.get(
        `https://api.smartthings.com/v1/devices/${device.deviceId}/health`,
        { headers: { Authorization: `Bearer ${PAT_TOKEN}` } }
      );

      const state = healthResponse.data.state;

      if (state === 'OFFLINE') {
        if (device.type === 'HUB') {
          offlineHubs.push(device.label);
        } else {
          offlineDevices.push(device.label);
        }
      }

      // Check battery if device has battery capability
      const hasBattery = device.components?.[0]?.capabilities?.some(c => c.id === 'battery');
      if (hasBattery) {
        await sleep(500);
        const statusResponse = await axios.get(
          `https://api.smartthings.com/v1/devices/${device.deviceId}/status`,
          { headers: { Authorization: `Bearer ${PAT_TOKEN}` } }
        );
        const batteryValue = statusResponse.data.components?.main?.battery?.battery?.value;
        if (batteryValue !== null && batteryValue !== undefined && batteryValue < BATTERY_THRESHOLD) {
          lowBatteryDevices.push({ name: device.label, battery: batteryValue });
        }
      }

    } catch (err) {
      console.log(`Error checking ${device.label}: ${err.message}`);
    }
  }

  // Send hub offline alerts (urgent)
  for (const hub of offlineHubs) {
    await sendEmail(
      `URGENT - Hub Offline — ${location.name}`,
      `Hub: ${hub}\nLocation: ${location.name}\nStatus: OFFLINE\n\nThis hub being offline may affect all devices at this location.\nPlease check immediately.`
    );
  }

  // Send device offline alerts
  if (offlineDevices.length > 0) {
    await sendEmail(
      `SmartThings - Devices Offline — ${location.name}`,
      `The following devices are offline at ${location.name}:\n\n${offlineDevices.map(d => `• ${d}`).join('\n')}\n\nPlease check these devices.`
    );
  }

  // Send low battery alerts
  if (lowBatteryDevices.length > 0) {
    await sendEmail(
      `SmartThings - Low Battery Alert — ${location.name}`,
      `The following devices have low battery at ${location.name}:\n\n${lowBatteryDevices.map(d => `• ${d.name}: ${d.battery}%`).join('\n')}\n\nPlease replace the batteries.`
    );
  }
}

async function main() {
  console.log('Starting SmartThings alerts check...');
  for (const location of LOCATIONS) {
    await checkLocation(location);
    await sleep(1000);
  }
  console.log('Done.');
}

main().catch(console.error);
