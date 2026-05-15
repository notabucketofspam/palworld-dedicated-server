const dgram = require('dgram');
const { spawn } = require('child_process');

// ==========================================
// CONFIGURATION SECTION
// ==========================================
const UDP_PORT = 8211;
const API_URL = 'http://127.0.0.1:8212/v1/api';
const ADMIN_PASSWORD = 'some_real_password'; // Change this!

// The command to start your server. 
// Adjust this path to wherever your PalServer.sh or executable lives.
const PAL_CMD = '/opt/palworld/PalServer.sh'; 
const PAL_ARGS = [
  '-useperfthreads',
  '-NoAsyncLoadingThread',
  '-UseMultithreadForDS',
  '-NumberOfWorkerThreadsServer=8'
]; // Add args here if needed, like ['-useperfthreads', '-NoAsyncLoadingThread']

// How often to check the player count (in milliseconds). 
// 5 minutes = 300000 ms.
const CHECK_INTERVAL_MS = 300 * 1000; 

// ==========================================
// STATE VARIABLES
// ==========================================
let udpServer = null;
let palProcess = null;
let monitorInterval = null;
let emptyChecks = 0;
let isShuttingDown = false;

// Create the Basic Auth header required by the Palworld REST API
const authHeader = {
    'Authorization': 'Basic ' + Buffer.from(`admin:${ADMIN_PASSWORD}`).toString('base64'),
    'Content-Type': 'application/json'
};

// Palworld connection initiation packet starts with 0x09 0x08 0x00
const MAGIC_PACKET = Buffer.from([0x09, 0x08, 0x00]);

// ==========================================
// UDP WAKE-ON-LAN LOGIC
// ==========================================
function startUdpListener() {
    udpServer = dgram.createSocket('udp4');

    udpServer.on('error', (err) => {
        console.error(`[UDP] Server error:\n${err.stack}`);
        udpServer.close();
    });

    udpServer.on('message', (msg, rinfo) => {
        
        if (msg.length >= 3 && msg.slice(0, 3).equals(MAGIC_PACKET)) {
            console.log(`[UDP] Received wake packet from ${rinfo.address}:${rinfo.port}! Starting Palworld...`);
            
            // Close the UDP socket so Palworld can bind to port 8211
            udpServer.close(() => {
                startPalworld();
            });
        }
    });

    udpServer.on('listening', () => {
        const address = udpServer.address();
        console.log(`[UDP] Sleeping... Listening for wake packets on port ${address.port}`);
    });

    udpServer.bind(UDP_PORT);
}

// ==========================================
// PALWORLD PROCESS MANAGEMENT
// ==========================================
function startPalworld() {
    isShuttingDown = false;
    emptyChecks = 0;

    console.log(`[SYS] Spawning Palworld process...`);
    palProcess = spawn(PAL_CMD, PAL_ARGS, { stdio: 'inherit' });

    // Start monitoring the player count after giving the server 30 seconds to boot
    setTimeout(startMonitoring, 30000);

    palProcess.on('close', (code) => {
        console.log(`[SYS] Palworld process exited with code ${code}.`);
        palProcess = null;
        
        if (monitorInterval) {
            clearInterval(monitorInterval);
        }

        // Server is dead. Time to go back to sleep and listen for packets.
        startUdpListener();
    });
}

// ==========================================
// IDLE MONITORING LOGIC
// ==========================================
function startMonitoring() {
    console.log(`[SYS] Commencing idle monitoring (Checks every ${CHECK_INTERVAL_MS / 1000}s)`);
    
    monitorInterval = setInterval(async () => {
        if (isShuttingDown) return;

        try {
            const response = await fetch(`${API_URL}/players`, { headers: authHeader });
            if (!response.ok) throw new Error(`API responded with ${response.status}`);
            
            const data = await response.json();
            const playerCount = data.players ? data.players.length : 0;

            if (playerCount === 0) {
                emptyChecks++;
                console.log(`[API] Server empty. Strike ${emptyChecks}/3.`);
                
                if (emptyChecks >= 3) {
                    console.log(`[API] Server empty for 3 checks. Initiating sleep sequence...`);
                    shutdownPalworld();
                }
            } else {
                if (emptyChecks > 0) console.log(`[API] Player detected! Resetting strike count.`);
                emptyChecks = 0;
            }
        } catch (error) {
            console.error(`[API] Error checking player count: ${error.message}`);
            // Note: We don't increment strikes on an API error, just in case the API is temporarily laggy.
        }
    }, CHECK_INTERVAL_MS);
}

// ==========================================
// GRACEFUL SHUTDOWN SEQUENCE
// ==========================================
async function shutdownPalworld() {
    isShuttingDown = true;
    
    try {
        console.log(`[API] Saving world state...`);
        await fetch(`${API_URL}/save`, { method: 'POST', headers: authHeader });
        
        console.log(`[API] World saved. Issuing shutdown command...`);
        await fetch(`${API_URL}/shutdown`, {
            method: 'POST',
            headers: authHeader,
            body: JSON.stringify({ waittime: 10, message: "Server going to sleep to save RAM." })
        });
        
        // At this point, the Palworld server will wait 10 seconds, then exit.
        // When it exits, the palProcess.on('close') event triggers automatically
        // and spins the UDP listener back up!
        
    } catch (error) {
        console.error(`[API] Failed to execute shutdown sequence: ${error.message}`);
        isShuttingDown = false; // Reset so we can try again next interval
    }
}

// ==========================================
// IGNITION
// ==========================================
console.log(`[SYS] Palworld Sleep Manager Initializing...`);
startUdpListener();
