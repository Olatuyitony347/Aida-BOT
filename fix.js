const axios = require('axios');
const { ethers } = require('ethers');
const fs = require('fs').promises;
const readline = require('readline');

// Konfigurasi referral
defaultConfig = {
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

// Fungsi untuk input user
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestion(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

// Fungsi untuk membuat wallet baru
function createWallet() {
    const wallet = ethers.Wallet.createRandom();
    console.log(`New Wallet: ${wallet.address}`);
    console.log(`PrivateKey: ${wallet.privateKey}`);
    console.log(`Seed Phrase: ${wallet.mnemonic.phrase}`);
    return wallet;
}

// Fungsi untuk menyimpan akun
async function saveAccount(wallet, refCode) {
    const data = `Address: ${wallet.address}\nPrivateKey: ${wallet.privateKey}\nSeedPhrase: ${wallet.mnemonic.phrase}\nRefCode: ${refCode}\n\n`;
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

// Fungsi untuk melakukan login
async function login(wallet, inviterCode) {
    const timestamp = Date.now();
    const message = `MESSAGE_ETHEREUM_${timestamp}:${timestamp}`;
    const signature = await signMessage(wallet, message);
    
    const url = `${defaultConfig.baseUrl}/user-auth/login?strategy=WALLET&chainType=EVM&address=${wallet.address}&token=${message}&signature=${signature}&inviter=${inviterCode}`;
    
    try {
        const response = await axios.get(url, { headers: defaultConfig.headers });
        console.log(`Login Success`);
        
        // Simpan akun dan token
        await saveAccount(wallet, response.data.user.refCode);
        await saveToken(response.data.tokens);
    } catch (error) {
        console.error(`Login Failed:`, error.response?.data || error.message);
    }
}

// Fungsi untuk membaca token
async function readTokens(filename) {
    try {
        const content = await fs.readFile(filename, 'utf8');
        return content.trim().split('\n').filter(token => token.length > 0);
    } catch (error) {
        console.error(`Error reading ${filename}:`, error.message);
        return [];
    }
}

// Mendapatkan misi yang tersedia
async function getAvailableMissions(accessToken) {
    try {
        const currentDate = new Date().toISOString();
        const response = await axios.get(
            `${defaultConfig.baseUrl}/questing/missions?filter%5Bdate%5D=${currentDate}&filter%5BcampaignId%5D=${defaultConfig.campaignId}`,
            { headers: { ...defaultConfig.headers, 'authorization': `Bearer ${accessToken}` } }
        );
        
        return response.data.data.filter(mission => mission.progress === "0" && mission.id !== defaultConfig.excludedMissionId);
    } catch (error) {
        console.error('Error fetching available missions:', error.response?.data || error.message);
        return [];
    }
}

// Menyelesaikan misi
async function completeMission(missionId, accessToken) {
    try {
        await axios.post(`${defaultConfig.baseUrl}/questing/mission-activity/${missionId}`, {}, {
            headers: { ...defaultConfig.headers, 'authorization': `Bearer ${accessToken}` }
        });
        console.log(`Mission ${missionId} completed successfully!`);
        return true;
    } catch (error) {
        console.error(`Error completing mission ${missionId}`);
        return false;
    }
}

// Klaim reward misi
async function claimMissionReward(missionId, accessToken) {
    try {
        await axios.post(`${defaultConfig.baseUrl}/questing/mission-reward/${missionId}`, {}, {
            headers: { ...defaultConfig.headers, 'authorization': `Bearer ${accessToken}` }
        });
        console.log(`Reward for mission ${missionId} claimed successfully!`);
        return true;
    } catch (error) {
        console.error(`Error claiming reward for mission ${missionId}`);
        return false;
    }
}

// Menjalankan bot
async function runBot() {
    console.log(`\nMenyelesaikan Misi`);
    
    const tokens = await readTokens('token.txt');
    if (tokens.length === 0) {
        console.error('No tokens found in token.txt');
        return;
    }
    
    for (let i = 0; i < tokens.length; i++) {
        const accessToken = tokens[i];
        console.log(`\nProcessing token ${i + 1}/${tokens.length}: ${accessToken.slice(0, 20)}...`);

        const availableMissions = await getAvailableMissions(accessToken);
        if (availableMissions.length === 0) {
            console.log('No available missions to complete.');
            continue;
        }

        for (const mission of availableMissions) {
            console.log(`Processing mission: ${mission.label} (ID: ${mission.id})`);
            
            const completed = await completeMission(mission.id, accessToken);
            if (completed) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                await claimMissionReward(mission.id, accessToken);
            }
            
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    console.log('\nsukses menjalankan semua token.');
}

// Fungsi utama
async function main() {
    const inviterCode = await askQuestion('Masukkan kode referral: ');
    const numAccounts = parseInt(await askQuestion('Masukkan jumlah akun yang ingin dibuat: '), 10);
    rl.close();
    
    for (let i = 0; i < numAccounts; i++) {
        console.log(`\nMembuat akun ${i + 1}/${numAccounts}...`);
        const wallet = createWallet();
        await login(wallet, inviterCode);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\nSemua akun berhasil dibuat.');
    await runBot();
}

main().catch(error => console.error('Bot encountered an error:', error));
