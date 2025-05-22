import { ethers } from "ethers";
import { createPublicClient, http, Log } from 'viem';
import { readFileSync } from 'fs'
import { DstackClient, to_hex } from '@phala/dstack-sdk';
import dotenv from 'dotenv';
import crypto from 'crypto';
import express from 'express';
dotenv.config();

export const dynamic = 'force-dynamic'

// --------------------- Configuration ---------------------
const RPC_URL = process.env.RPC_URL; // Ethereum RPC URL, set through environment variables
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS; // VRFCoordinator contract address, set through environment variables
const provider = new ethers.JsonRpcProvider(RPC_URL);
const teeWallet = new ethers.Wallet('0x' + Buffer.from(ethers.randomBytes(32)).toString('hex'), provider); // generate a random wallet in TEE

// Add retry mechanism for transaction sending
const MAX_RETIRES = 3;
async function sendTransactionWithRetry(txResponse: ethers.TransactionResponse, retries = MAX_RETIRES) {
    try {
        // Wait for transaction confirmation
        const receipt = await txResponse.wait();
        return receipt;
    } catch (error) {
        if (retries > 0) {
            console.warn(`Transaction failed, remaining retries: ${retries}`, error);
            await new Promise(resolve => setTimeout(resolve, 2000));
            return sendTransactionWithRetry(txResponse, retries - 1); // Pass the original transaction object
        }
        throw new Error(`Transaction failed, maximum retries reached: ${error}`);
    }
}
// Check balance
let balance: bigint = 0n;
(async () => {
    balance = await provider.getBalance(teeWallet.address);
    console.log(`Current balance: ${ethers.formatEther(balance)} SEP`);
})();
const VRFCoordinatorABI = JSON.parse(readFileSync('./artifacts/VRFCoordinatorAbi.json', 'utf-8'));
const vrfCoordinator = new ethers.Contract(
    CONTRACT_ADDRESS!,
    VRFCoordinatorABI,
    teeWallet
);
// Uncomment the following lines if you need to set trustedTEE in TEE
/*
const CONTRACT_OWNER_PRIVATE_KEY = process.env.CONTRACT_OWNER_PRIVATE_KEY; // Contract owner private key (confidential) This key should be set through environment variables
const contractOwnerWallet = new ethers.Wallet(CONTRACT_OWNER_PRIVATE_KEY!, provider);
const contractOperator = new ethers.Contract(
    CONTRACT_ADDRESS!,
    VRFCoordinatorABI,
    contractOwnerWallet
);
// --------------------- Set trustedTEE ---------------------
export async function setTrustedTEE() {
    const address = teeWallet.address;

    const gasEstimate = await contractOperator.setTrustedThirdParty.estimateGas(address);
    console.log(`Estimated Gas consumption: ${gasEstimate.toString()}`);

    // Execute actual transaction
    const txResponse = await contractOperator.setTrustedThirdParty(address, {
        gasLimit: gasEstimate * 12n / 10n // BigInt calculation
    });

    console.log(`setTrustedThirdParty Transaction sent, hash: ${txResponse.hash}`);
    const receipt = await sendTransactionWithRetry(txResponse);
    console.log(`setTrustedThirdParty Transaction confirmed in block ${receipt?.blockNumber}`);
}
(async () => {
    await setTrustedTEE();
})().catch(error => {
    console.error('Error setting trustedTEE:', error);
    process.exit(1);
});
*/

let rootKey: string;

// --------------------- Monitor Queue ---------------------
const publicClient = createPublicClient({
    transport: http(RPC_URL)
});

interface RequestQueuedEvent {
    requestId: bigint;
    caller: `0x${string}`;
    seed: bigint;
}

// Initialization function
async function initialize() {
    try {
        // Initialize keys
        rootKey = await initKeys();
        console.log('Key initialization completed');
    } catch (error) {
        console.error('Initialization failed:', error);
        process.exit(1);
    }
}

const app = express();
app.use(express.json());
app.get('/get_wallet', async (req, res) => {
    try {
        const address = teeWallet.address;
        res.json({ Ethereum_wallet_address: address });
    } catch (error) {
        res.status(500).json({ error: 'Key not initialized' });
    }
});

app.get('/pubkey', async (req, res) => {
    try {
        const pubKey = getPubKey();
        res.json({ address: pubKey });
    } catch (error) {
        res.status(500).json({ error: 'Key not initialized' });
    }
});

app.get('/update-secretkey', async (req, res) => {
    try {
        updateSecretKey();
        res.json({
            status: 'success',
            message: 'Private key updated',
            new_pubkey: getPubKey()
        });
    } catch (error) {
        console.error('Update failed:', error);
        const statusCode = (error as any).statusCode || 500;
        res.status(statusCode).json({
            error: (error as Error).message,
            statusCode
        });
    }
});

// Wrap async initialization in immediately executed function
(async () => {
    await initialize();
    app.listen(3000, () => {
        console.log('Key API server running on port 3000');
    });
})().catch(error => {
    console.error('Error in initialization process:', error);
    process.exit(1);
});

publicClient.watchContractEvent({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: VRFCoordinatorABI,
    eventName: 'RequestQueued',
    onLogs: async (logs: Log[]) => {
        for (const log of logs) {
            const { requestId, caller, seed } = (log as any).args as RequestQueuedEvent;
            await processRequest(requestId, seed);
        }
    }
});


// --------------------- Process Request ---------------------
async function processRequest(requestId: bigint, seed: bigint): Promise<void> {
    // 1. Generate random number (based on seed + global key)
    const random = generateRandom(seed, rootKey);

    // 2. Construct signature message (requestId + seed + random)
    const messageHash = ethers.solidityPackedKeccak256(
        ["uint256", "uint256", "uint256"],
        [requestId, seed, random]
    );

    // 3. Sign message
    const rootSigner = new ethers.Wallet(rootKey, provider);
    const signature = await rootSigner.signMessage(ethers.getBytes(messageHash));

    // 4. Submit to chain
    const tx = await vrfCoordinator.onRandomGenerated(
        requestId,
        random,
        signature
    );
    const receipt = await sendTransactionWithRetry(tx);
    console.log(`onRandomGenerated Transaction confirmed in block ${receipt?.blockNumber}`);
}

// --------------------- Init Keys ---------------------
async function initKeys(): Promise<string> {
    const client = new DstackClient();
    await client.info();
    const testDeriveKey = await client.getKey("ethereum");
    const key = to_hex(testDeriveKey.key);
    return key.startsWith('0x') ? key : `0x${key}`;
}

// --------------------- Update Private Key -------------------------
function updateSecretKey(): void {
    const salt = crypto.randomBytes(16); // random salt
    const derivedKey = crypto.pbkdf2Sync(
        rootKey,
        salt,
        10,     // iterations
        32,     // output key length
        'sha256'
    );
    const keyInt = BigInt('0x' + derivedKey.toString('hex')) %
        BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
    rootKey = '0x' + keyInt.toString(16).padStart(64, '0');
    console.log('Private key update completed');
}

// --------------------- Get Public Key Address ---------------------
function getPubKey(): string {
    const pubkey = new ethers.Wallet(rootKey).address;
    return pubkey;
}

// --------------------- Secure Random Number Generation ---------------------
function generateRandom(seed: bigint, rootKey: string): bigint {
    const hash = crypto.createHash('sha256')
        .update(seed.toString() + rootKey.toString())
        .digest('hex');
    return BigInt('0x' + hash) % (10n ** 18n); // Generate deterministic 18-digit random number
}

// --------------------- Start Monitoring ---------------------
console.log("OffChain processor started...");