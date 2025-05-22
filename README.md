# Phala Cloud VRF 

A Verifiable Random Function (VRF) implementation leveraging Trusted Execution Environment (TEE) technology on [Phala Cloud](https://cloud.phala.network/) and [DStack](https://github.com/dstack-TEE/dstack/). Provides cryptographically verifiable randomness for blockchain applications with enhanced security guarantees through hardware isolation.

## Overview

This implementation combines on-chain smart contracts with off-chain TEE computation to deliver:
- **Tamper-proof randomness generation** - Secure enclave execution prevents manipulation
- **Cryptographic verification** - Elliptic curve signatures prove randomness authenticity
- **Decentralized trust** - Trust anchored in hardware security rather than individual entities

The system comprises:
1. On-chain VRF Coordinator Contract
2. Off-chain VRF Generator (Confidential VM)
3. Client-facing API endpoints

## VRF Workflow

### 1. Initial Setup
```mermaid
sequenceDiagram
    participant ContractOwner
    participant Contract
    participant Offchain-VRF
  
    Offchain-VRF->>Offchain-VRF: Randomly generates wallet keypair (wallet_sk, wallet_address)
    Offchain-VRF->>Offchain-VRF: TEE generates signing keypair (signing_sk, signing_pubkey)
    ContractOwner->>Offchain-VRF: GET /address
    Offchain-VRF->>ContractOwner: Return wallet_address
    ContractOwner->>Contract: setTrustedThirdParty(wallet_address)
    ContractOwner->>Offchain-VRF: GET /pubkey
    Offchain-VRF->>ContractOwner: Return signing_pubkey
    ContractOwner->>Contract: updateOfflinePublicKey(signing_pubkey)
```

- **Trusted Wallet Identity Establishment**
  Offchain-VRF generates `wallet_sk` (private key) and derives `wallet_address`. Contract owner registers this address as trusted via `setTrustedThirdParty()`. And further transactions are sent from this wallet address.

- **OffChain Key Distribution by TEE**
  TEE generates separate `signing_sk` for VRF operations. Contract owner retrieves the corresponding public key via `/pubkey` endpoint and register it on-chain

### 2. Randomness Request Flow
```mermaid
sequenceDiagram
    participant User
    participant Contract
    participant Offchain-VRF
  
    User->>Contract: requestRandomNumber(seed)
    Contract->>Contract: Store request in queue
    Contract-->>Offchain-VRF: Emit RequestQueued(requestId, seed)
    Offchain-VRF->>Offchain-VRF: Listen for RequestQueued events
    Offchain-VRF->>Offchain-VRF: Compute random = VRF(signing_sk, seed)
    Offchain-VRF->>Offchain-VRF: Sign(requestId + seed + random)
    Offchain-VRF->>Contract: onRandomGenerated(requestId, random, signature)
    Contract->>Contract: Verify signature matches signing_pubkey
    Contract-->>Contract: Emit RandomFulfilled(requestId)
```

- **Request Initiation**
  Users submit randomness requests with unique seeds via `requestRandomNumber(seed)`

- **TEE Computation**
  Offchain-VRF monitors events and processes queued requests using:
  ```ts
  random = SHA256(signing_sk + seed)
  signature = ethers.Wallet.signMessage(signing_sk, solidityPackedKeccak256(requestId, seed, random))
  ```

- **On-chain Verification**
  Contract verifies using ECDSA recovery:
  ```solidity
  address recovered = ecrecover(hash, v, r, s);
  require(recovered == signing_pubkey, "Invalid signature");
  ```

## Key Features

- **TEE-Backed Security**
  - Secure key generation & storage in enclave
  - Memory encryption and attestation proofs

- **Verifiability**
  - Cryptographic proof of correct computation
  - On-chain signature verification

- **Fault Tolerance**
  - Automatic request retries
  - Transaction nonce management

- **Monitoring**
  - Real-time request tracking via API
  - Event history inspection

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/address` | GET | Returns TEE's operational wallet address |
| `/pubkey` | GET | Retrieves offline public key for VRF verification |
| `/requests` | GET | Lists pending randomness requests |

## Development Setup

### Prerequisites
- [Node.js](https://nodejs.org/en) ≥ 18.18
- [Docker](https://www.docker.com/)
- Phala Cloud account

1. Clone repository:
```bash
git clone https://github.com/your-org/phala-cloud-vrf.git --recursive
cd phala-cloud-vrf
```

2. Configure environment:
```bash
cp env.local.example .env.local
# Set Ethereum RPC and contract address
```

3. Start local simulator:
```bash
git clone --recursive https://github.com/Dstack-TEE/meta-dstack.git
cd meta-dstack/dstack/sdk/simulator
./build.sh && ./dstack-simulator
```

4. Launch service:
```bash
docker-compose up
```

## Demo Contract:

You can use the demo contract to test the VRF workflow. The contract is deployed on [Sepolia testnet](https://sepolia.etherscan.io/address/0xafe5adfe149a99ac8c5b5e37a9ab53dc9193313e).

You can check the transactions and events on the testnet. The speed of the transactions is fast, it only costs 1 block to generate the random number. If you want to test the VRF workflow, you can use the `request.ts` in the scrips folder to test the VRF workflow.

First, you should run the dstack simulator, then run docker-compose up to start the service.
Then you can run the `request.ts` to test the VRF workflow.
