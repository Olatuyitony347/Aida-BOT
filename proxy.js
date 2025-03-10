const axios = require('axios');
const { ethers } = require('ethers');
const fs = require('fs').promises;
const HttpsProxyAgent = require('https-proxy-agent'); // Import proxy agent

// Konfigurasi referral
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

// Fungsi untuk membaca proxy dari file
async function readProxies(filename) {
    try {
        const content = await fs.readFile(filename, 'utf8');
        return content.trim().split('\n').filter(proxy => proxy.length > 0);
    } catch (error) {
        console.error(`Error reading ${filename}:`, error.message);
        return [];
    }
}

// Fungsi untuk membuat wallet baru
function createWallet() {
    const wallet = ethers.Wallet.createRandom();
    console.log(`New Wallet: ${wallet.address}`);
    return wallet;
}

// Fungsi untuk menyimpan akun
async function saveAccount(wallet, refCode) {
    const data = `Address: ${wallet.address}\nPrivateKey: ${wallet.privateKey}\nRefCode: ${refCode}\n\n`;
    await fs.appendFile('accounts.txt', data);
    console.log(`Account saved to accounts.txt`);
}

// Fungsi untuk menyimpan token
async function saveToken(token) {
    await fs.appendFile('token.txt', `${token.access_token}\n`);
    console.log(`Access token saved to token.txt`);
}

// Fungsi untuk menandatangani pesan autentikasi
async function signMessage(wallet, message) {
    return await wallet.signMessage(message);
}

// Fungsi untuk melakukan login dengan proxy
async function login(wallet, proxy) {
    const timestamp = Date.now();
    const message = `MESSAGE_ETHEREUM_${timestamp}:${timestamp}`;
    const signature = await signMessage(wallet, message);
    
    const url = `${config.baseUrl}/user-auth/login?strategy=WALLET&chainType=EVM&address=${wallet.address}&token=${message}&signature=${signature}&inviter=${INVITER_CODE}`;

    const agent = new HttpsProxyAgent(proxy); // Set proxy

    try {
        const response = await axios.get(url, { 
            headers: config.headers,
            httpsAgent: agent 
        });
        console.log(`Login Success with proxy: ${proxy}`);
        
        // Simpan akun dan token
        await saveAccount(wallet, response.data.user.refCode);
        await saveToken(response.data.tokens);
    } catch (error) {
        console.error(`Login Failed with proxy ${proxy}:`, error.message);
    }
}

// Membaca token dari file
async function readTokens(filename) {
    try {
        const content = await fs.readFile(filename, 'utf8');
        return content.trim().split('\n').filter(token => token.length > 0);
    } catch (error) {
        console.error(`Error reading ${filename}:`, error.message);
        return [];
    }
}

// Mendapatkan misi yang tersedia dengan proxy
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
        console.error(`Error fetching available missions with proxy ${proxy}:`, error.message);
        return [];
    }
}

// Menyelesaikan misi dengan proxy
async function completeMission(missionId, accessToken, proxy) {
    const agent = new HttpsProxyAgent(proxy);

    try {
        await axios.post(`${config.baseUrl}/questing/mission-activity/${missionId}`, {}, {
            headers: { ...config.headers, 'authorization': `Bearer ${accessToken}` },
            httpsAgent: agent
        });
        console.log(`Mission ${missionId} completed successfully with proxy ${proxy}!`);
        return true;
    } catch (error) {
        console.error(`Error completing mission ${missionId} with proxy ${proxy}`);
        return false;
    }
}

// Klaim reward misi dengan proxy
async function claimMissionReward(missionId, accessToken, proxy) {
    const agent = new HttpsProxyAgent(proxy);

    try {
        await axios.post(`${config.baseUrl}/questing/mission-reward/${missionId}`, {}, {
            headers: { ...config.headers, 'authorization': `Bearer ${accessToken}` },
            httpsAgent: agent
        });
        console.log(`Reward for mission ${missionId} claimed successfully with proxy ${proxy}!`);
        return true;
    } catch (error) {
        console.error(`Error claiming reward for mission ${missionId} with proxy ${proxy}`);
        return false;
    }
}

// Menjalankan bot dengan proxy
async function runBot(proxies) {
    console.log(`\nMenyelesaikan Misi`);

    const tokens = await readTokens('token.txt');
    if (tokens.length === 0) {
        console.error('No tokens found in token.txt');
        return;
    }

    for (let i = 0; i < tokens.length; i++) {
        const accessToken = tokens[i];
        const proxy = proxies[i % proxies.length]; // Assign proxy per account
        console.log(`\nProcessing token ${i + 1}/${tokens.length} using proxy: ${proxy}`);

        const availableMissions = await getAvailableMissions(accessToken, proxy);
        if (availableMissions.length === 0) {
            console.log('No available missions to complete.');
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
    }

    console.log('\nBot finished processing all tokens.');
}

// Eksekusi bot
async function main() {
    const proxies = await readProxies('proxy.txt');
    
    if (proxies.length === 0) {
        console.error('No proxies found in proxy.txt');
        return;
    }

    const wallet = createWallet();
    const proxy = proxies[0]; // Use first proxy for initial login

    await login(wallet, proxy);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Delay sebelum eksekusi bot
    await runBot(proxies);
}

main().catch(error => console.error('Bot encountered an error:', error));
