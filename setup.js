import { execSync } from 'child_process';
import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/setup', (req, res) => {
  try {
    // Download SmartThings CLI
    execSync('curl -L https://github.com/SmartThingsCommunity/smartthings-cli/releases/latest/download/smartthings-linux-x64.tar.gz -o /tmp/st.tar.gz');
    execSync('tar -xzf /tmp/st.tar.gz -C /tmp');
    execSync('chmod +x /tmp/smartthings');
    
    res.send('CLI downloaded. Now go to /create to create the OAuth app.');
  } catch (err) {
    res.send(`Error: ${err.message}`);
  }
});

app.get('/', (req, res) => {
  res.send('<a href="/setup">Click here to set up SmartThings CLI</a>');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
