import { createWalletClient, createPublicClient, http, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import * as dotenv from 'dotenv';
dotenv.config();

const sepolia = defineChain({
    id: 11155111,
    name: 'Sepolia',
    network: 'sepolia',
    nativeCurrency: { name: 'Sepolia Ether', symbol: 'SEP', decimals: 18 },
    rpcUrls: {
      default: { http: [process.env.RPC_URL!] },
    },
    blockExplorers: {
      default: { name: 'Etherscan', url: 'https://sepolia.etherscan.io' },
    },
  });
const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const walletClient = createWalletClient({ account, chain: sepolia, transport: http() });

async function requestRandomNumber(contractAddress: string) {
  const hash = await walletClient.writeContract({
    address: contractAddress as `0x${string}`,
    abi: JSON.parse(require('fs').readFileSync('./artifacts/VRFCoordinatorAbi.json', 'utf-8')),
    functionName: 'requestRandomNumber',
    args: [30], // seed=30
  });

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(),
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log('Tx hash:', receipt.transactionHash);
}

async function updateOfflinePublicKey(contractAddress: string) {
  const hash = await walletClient.writeContract({
    address: contractAddress as `0x${string}`,
    abi: JSON.parse(require('fs').readFileSync('./artifacts/VRFCoordinatorAbi.json', 'utf-8')),
    functionName: 'updateOfflinePublicKey',
    args: ["xxx" as `0x${string}`], // seed=publicKey
  });

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(),
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log('Tx hash:', receipt.transactionHash);
}

async function setTrustedThirdParty(contractAddress: string) {
  const hash = await walletClient.writeContract({
    address: contractAddress as `0x${string}`,
    abi: JSON.parse(require('fs').readFileSync('./artifacts/VRFCoordinatorAbi.json', 'utf-8')),
    functionName: 'setTrustedThirdParty',
    args: ["xxx" as `0x${string}`], // seed=walletAddress
  });

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(),
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log('Tx hash:', receipt.transactionHash);
}

setTrustedThirdParty('xxx').catch(console.error);
updateOfflinePublicKey('xxx').catch(console.error);
requestRandomNumber('0xAFE5ADfE149a99Ac8C5B5E37A9ab53DC9193313E').catch(console.error);