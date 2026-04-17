// Waits for Vite dev server to be ready, then launches Electron
const http = require('http');
const { spawn } = require('child_process');

const VITE_URL = 'http://localhost:5173';
const MAX_RETRIES = 30;
let retries = 0;

function checkVite() {
  http.get(VITE_URL, (res) => {
    console.log('Vite is ready, launching Electron...');
    const electron = require('electron');
    const child = spawn(electron, ['.'], {
      stdio: 'inherit',
      env: { ...process.env, VITE_DEV_SERVER_URL: VITE_URL }
    });
    child.on('close', (code) => process.exit(code));
  }).on('error', () => {
    retries++;
    if (retries >= MAX_RETRIES) {
      console.error('Vite server did not start in time');
      process.exit(1);
    }
    console.log(`Waiting for Vite... (${retries}/${MAX_RETRIES})`);
    setTimeout(checkVite, 1000);
  });
}

checkVite();
