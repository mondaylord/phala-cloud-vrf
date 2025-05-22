import { createPublicClient, createWalletClient, http, defineChain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { readFileSync } from 'fs'
import { join } from 'path'
import 'dotenv/config'

const contractPath = join(__dirname, '../artifacts')
const abi = JSON.parse(readFileSync(join(contractPath, 'VRFCoordinatorAbi.json'), 'utf8'))
const bytecode = readFileSync(join(contractPath, 'VRFCoordinatorBytecode.txt'), 'utf8')


const sepolia = defineChain({
    id: 11155111,
    name: 'Sepolia',
    network: 'sepolia',
    nativeCurrency: { name: 'Sepolia Ether', symbol: 'SEP', decimals: 18 },
    rpcUrls: {
        default: { http: [process.env.SEPOLIA_RPC_URL!] },
    },
    blockExplorers: {
        etherscan: {
            name: 'Etherscan',
            url: 'https://sepolia.etherscan.io',
            apiUrl: 'https://api-sepolia.etherscan.io/api',
            apiKey: "xxx"
        },
        default: { name: 'Etherscan', url: 'https://sepolia.etherscan.io' },
    },
});

const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(),
});

const privateKey = process.env.PRIVATE_KEY
if (!privateKey) throw new Error('Missing PRIVATE_KEY in .env file')

const account = privateKeyToAccount(privateKey as `0x${string}`)
const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http()
});

async function main() {
    console.log('Deploying VRFCoordinator...')
    const hash = await walletClient.deployContract({
        abi,
        bytecode: `0x${bytecode}` as `0x${string}`,
        args: []
    })

    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    console.log('VRFCoordinator deployed at:', receipt.contractAddress)
    return receipt.contractAddress
}

main().catch(console.error)