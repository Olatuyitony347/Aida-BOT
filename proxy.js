const axios = require('axios');
const { ethers } = require('ethers');
const fs = require('fs').promises;
const { HttpsProxyAgent } = require('https-proxy-agent'); // Import proxy agent

// Referral Configuration
const INVITER_CODE = "2fw-wMUs7VBWY__";
const config = {
    baseUrl: 'https://back.aidapp.com',
    campaignId: '6b963d81-a8e9-4046-b14f-8454bc3e6eb2',
    excludedMissionId: 'f8edb0b4-ac7d-4a32-8522-65c5fb053725',
    headers: {
        'accept': '*/*',
        'origin': 'https://my.aidapp.com',
        'referer': 'https://my.aidapp.com/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    }
};

// Read proxies from file
async function readProxies(filename) {
    try {
        const content = await fs.readFile(filename, 'utf8');
        return content.trim().split('\n').filter(proxy => proxy.length > 0);
    } catch (error) {
        console.error(`Error reading ${filename}:`, error.message);
        return [];
    }
}

// Create a new wallet
function createWallet() {
    const wallet = ethers.Wallet.createRandom();
    console.log(`New Wallet: ${wallet.address}`);
    return wallet;
}

// Save account details
async function saveAccount(wallet, refCode) {
    const data = `Address: ${wallet.address}\nPrivateKey: ${wallet.privateKey}\nRefCode: ${refCode}\n\n`;
    await fs.appendFile('accounts.txt', data);
    console.log(`Account saved to accounts.txt`);
}

// Save access token
async function saveToken(token) {
    await fs.appendFile('token.txt', `${token.access_token}\n`);
    console.log(`Access token saved to token.txt`);
}

// Sign authentication message
async function signMessage(wallet, message) {
    return await wallet.signMessage(message);
}

// Perform login using a proxy
async function login(wallet, proxy) {
    const timestamp = Date.now();
    const message = `MESSAGE_ETHEREUM_${timestamp}:${timestamp}`;
    const signature = await signMessage(wallet, message);
    
    const url = `${config.baseUrl}/user-auth/login?strategy=WALLET&chainType=EVM&address=${wallet.address}&token=${message}&signature=${signature}&inviter=${INVITER_CODE}`;

    const agent = new HttpsProxyAgent(proxy); // Use proxy

    try {
        const response = await axios.get(url, { 
            headers: config.headers,
            httpsAgent: agent 
        });
        console.log(`Login Success with proxy: ${proxy}`);
        
        // Save account and token
        await saveAccount(wallet, response.data.user.refCode);
        await saveToken(response.data.tokens);
    } catch (error) {
        console.error(`Login Failed with proxy ${proxy}:`, error.message);
    }
}

// Execute bot to create 100 accounts with proxies
async function main() {
    const proxies = await readProxies('proxy.txt');
    
    if (proxies.length === 0) {
        console.error('No proxies found in proxy.txt');
        return;
    }

    console.log(`\nStarting account creation...`);
    
    for (let i = 0; i < 100; i++) {
        const wallet = createWallet();
        const proxy = proxies[i % proxies.length]; // Assign a proxy, looping if fewer than 100

        console.log(`\n[${i + 1}/100] Logging in with proxy: ${proxy}`);
        await login(wallet, proxy);

        // Small delay between account creation to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    console.log('\nFinished creating 100 accounts.');
}

main().catch(error => console.error('Bot encountered an error:', error));
