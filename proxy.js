const axios = require('axios');
const { ethers } = require('ethers');
const fs = require('fs').promises;
const { HttpsProxyAgent } = require('https-proxy-agent');

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

// Login and return access token
async function login(wallet, proxy) {
    const timestamp = Date.now();
    const message = `MESSAGE_ETHEREUM_${timestamp}:${timestamp}`;
    const signature = await signMessage(wallet, message);
    
    const url = `${config.baseUrl}/user-auth/login?strategy=WALLET&chainType=EVM&address=${wallet.address}&token=${message}&signature=${signature}&inviter=${INVITER_CODE}`;
    
    const agent = new HttpsProxyAgent(proxy);

    try {
        const response = await axios.get(url, { 
            headers: config.headers,
            httpsAgent: agent 
        });
        console.log(`Login Success with proxy: ${proxy}`);
        
        // Save account and token
        await saveAccount(wallet, response.data.user.refCode);
        await saveToken(response.data.tokens);
        
        return response.data.tokens.access_token; // Return token for task execution
    } catch (error) {
        console.error(`Login Failed with proxy ${proxy}:`, error.message);
        return null;
    }
}

// Get available missions
async function getAvailableMissions(accessToken, proxy) {
    const agent = new HttpsProxyAgent(proxy);

    try {
        const currentDate = new Date().toISOString();
        const response = await axios.get(
            `${config.baseUrl}/questing/missions?filter%5Bdate%5D=${currentDate}&filter%5BcampaignId%5D=${config.campaignId}`,
            { 
                headers: { ...config.headers, 'authorization': `Bearer ${accessToken}` },
                httpsAgent: agent
            }
        );
        
        return response.data.data.filter(mission => mission.progress === "0" && mission.id !== config.excludedMissionId);
    } catch (error) {
        console.error(`Error fetching missions with proxy ${proxy}:`, error.message);
        return [];
    }
}

// Complete a mission
async function completeMission(missionId, accessToken, proxy) {
    const agent = new HttpsProxyAgent(proxy);

    try {
        await axios.post(`${config.baseUrl}/questing/mission-activity/${missionId}`, {}, {
            headers: { ...config.headers, 'authorization': `Bearer ${accessToken}` },
            httpsAgent: agent
        });
        console.log(`Mission ${missionId} completed successfully with proxy ${proxy}`);
        return true;
    } catch (error) {
        console.error(`Error completing mission ${missionId} with proxy ${proxy}`);
        return false;
    }
}

// Claim mission reward
async function claimMissionReward(missionId, accessToken, proxy) {
    const agent = new HttpsProxyAgent(proxy);

    try {
        await axios.post(`${config.baseUrl}/questing/mission-reward/${missionId}`, {}, {
            headers: { ...config.headers, 'authorization': `Bearer ${accessToken}` },
            httpsAgent: agent
        });
        console.log(`Reward for mission ${missionId} claimed successfully with proxy ${proxy}`);
        return true;
    } catch (error) {
        console.error(`Error claiming reward for mission ${missionId} with proxy ${proxy}`);
        return false;
    }
}

// Run bot: Create an account, login, perform missions before moving to next proxy
async function runBot(proxies) {
    console.log(`\nStarting Account Creation and Mission Execution...`);
    
    for (let i = 0; i < 100; i++) {
        const wallet = createWallet();
        const proxy = proxies[i % proxies.length]; // Assign a proxy, looping if fewer than 100
        
        console.log(`\n[${i + 1}/100] Logging in with proxy: ${proxy}`);
        const accessToken = await login(wallet, proxy);

        if (!accessToken) {
            console.log(`Skipping account ${wallet.address} due to failed login.`);
            continue;
        }

        console.log(`\nFetching available missions for ${wallet.address}...`);
        const availableMissions = await getAvailableMissions(accessToken, proxy);
        
        if (availableMissions.length === 0) {
            console.log(`No available missions for ${wallet.address}. Moving to next account.`);
            continue;
        }

        for (const mission of availableMissions) {
            console.log(`Processing mission: ${mission.label} (ID: ${mission.id})`);
            
            const completed = await completeMission(mission.id, accessToken, proxy);
            if (completed) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                await claimMissionReward(mission.id, accessToken, proxy);
            }

            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        console.log(`\nFinished processing account ${i + 1}. Moving to the next...`);
        await new Promise(resolve => setTimeout(resolve, 3000)); // Delay to prevent rate limits
    }

    console.log('\nBot finished creating accounts and executing missions.');
}

// Execute bot
async function main() {
    const proxies = await readProxies('proxy.txt');
    
    if (proxies.length === 0) {
        console.error('No proxies found in proxy.txt');
        return;
    }

    await runBot(proxies);
}

main().catch(error => console.error('Bot encountered an error:', error));
