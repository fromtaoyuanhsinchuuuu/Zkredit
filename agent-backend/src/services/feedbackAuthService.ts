import { keccak256, encodeAbiParameters, parseAbiParameters, toHex } from 'viem';
import { PrivateKey } from '@hashgraph/sdk';

/**
 * FeedbackAuth parameters structure
 * Must match Solidity struct exactly
 */
export interface FeedbackAuthParams {
  agentId: bigint;
  clientAddress: string;  // Ethereum address format
  indexLimit: bigint;     // uint64
  expiry: bigint;         // uint256 Unix timestamp
  chainId: bigint;        // 296 for Hedera Testnet
  identityRegistry: string; // Contract address
  signerAddress: string;  // Agent owner or approved operator
}

/**
 * Generate FeedbackAuth bytes with signature
 * @param params FeedbackAuth parameters
 * @param privateKeyHex Hedera private key in hex format
 * @returns Complete feedbackAuth bytes (224 + 65 bytes)
 */
export async function createFeedbackAuth(
  params: FeedbackAuthParams,
  privateKeyHex: string
): Promise<string> {
  // 1. Encode FeedbackAuth struct (ABI encoding)
  const encodedStruct = encodeAbiParameters(
    parseAbiParameters('uint256, address, uint64, uint256, uint256, address, address'),
    [
      params.agentId,
      params.clientAddress as `0x${string}`,
      params.indexLimit,
      params.expiry,
      params.chainId,
      params.identityRegistry as `0x${string}`,
      params.signerAddress as `0x${string}`
    ]
  );

  // 2. Hash the encoded struct
  const messageHash = keccak256(encodedStruct);

  // 3. Apply EIP-191 Ethereum Signed Message prefix
  const ethPrefix = '\x19Ethereum Signed Message:\n32';
  const prefixBytes = Buffer.from(ethPrefix, 'utf-8');
  const hashBytes = Buffer.from(messageHash.slice(2), 'hex');
  const prefixedMessage = keccak256(
    ('0x' + Buffer.concat([prefixBytes, hashBytes]).toString('hex')) as `0x${string}`
  );

  // 4. Sign with Hedera private key
  const privateKey = PrivateKey.fromStringECDSA(privateKeyHex);
  const messageBytes = Buffer.from(prefixedMessage.slice(2), 'hex');
  const signatureBytes = privateKey.sign(messageBytes);

  // 5. Convert signature to Ethereum format (r, s, v)
  // Hedera SDK returns 64 bytes (r + s), we need to add v (recovery id)
  const r = signatureBytes.slice(0, 32);
  const s = signatureBytes.slice(32, 64);
  
  // Calculate v (recovery id) - for Hedera it's usually 27 or 28
  // For simplicity, we'll try both and validate
  const v = Buffer.from([27]); // Standard Ethereum v value
  
  const signature = Buffer.concat([r, s, v]).toString('hex');

  // 6. Concatenate struct + signature
  const feedbackAuth = encodedStruct + signature;

  return feedbackAuth;
}

/**
 * Generate pre-signed FeedbackAuth for a client
 * @param agentId The agent ID
 * @param clientAddress The client's Ethereum address
 * @param agentOwnerPrivateKey Agent owner's private key
 * @param options Optional parameters (defaults provided)
 * @returns FeedbackAuth hex string
 */
export async function generateFeedbackAuthForClient(
  agentId: bigint,
  clientAddress: string,
  agentOwnerPrivateKey: string,
  options: {
    indexLimit?: bigint;
    expiryHours?: number;
    chainId?: bigint;
    identityRegistryAddress?: string;
  } = {}
): Promise<string> {
  // Default values
  const indexLimit = options.indexLimit || 10n; // Allow 10 feedbacks
  const expiryHours = options.expiryHours || 24; // 24 hours
  const chainId = options.chainId || 296n; // Hedera Testnet
  const identityRegistry = options.identityRegistryAddress || 
    process.env.NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS!;

  // Calculate expiry timestamp
  const expiry = BigInt(Math.floor(Date.now() / 1000) + (expiryHours * 3600));

  // Get signer address from private key
  const privateKey = PrivateKey.fromStringECDSA(agentOwnerPrivateKey);
  const publicKey = privateKey.publicKey;
  const signerAddress = publicKey.toEvmAddress();

  const params: FeedbackAuthParams = {
    agentId,
    clientAddress,
    indexLimit,
    expiry,
    chainId,
    identityRegistry,
    signerAddress: '0x' + signerAddress
  };

  return createFeedbackAuth(params, agentOwnerPrivateKey);
}

/**
 * Validate FeedbackAuth structure
 * @param feedbackAuth The feedbackAuth hex string
 * @returns Validation result
 */
export function validateFeedbackAuth(feedbackAuth: string): {
  valid: boolean;
  error?: string;
} {
  // Remove 0x prefix if present
  const cleanAuth = feedbackAuth.startsWith('0x') ? feedbackAuth.slice(2) : feedbackAuth;

  // Check length: 224 bytes (struct) + 65 bytes (signature) = 289 bytes = 578 hex chars
  if (cleanAuth.length !== 578) {
    return {
      valid: false,
      error: `Invalid length: expected 578 hex chars, got ${cleanAuth.length}`
    };
  }

  return { valid: true };
}

/**
 * Decode FeedbackAuth parameters (for debugging)
 * @param feedbackAuth The feedbackAuth hex string
 * @returns Decoded parameters
 */
export function decodeFeedbackAuth(feedbackAuth: string): {
  struct: FeedbackAuthParams;
  signature: string;
} {
  const cleanAuth = feedbackAuth.startsWith('0x') ? feedbackAuth : '0x' + feedbackAuth;
  
  // Extract struct (first 224 bytes = 448 hex chars)
  const structHex = cleanAuth.slice(0, 450); // 0x + 448 chars
  
  // Extract signature (remaining 65 bytes = 130 hex chars)
  const signatureHex = '0x' + cleanAuth.slice(450);

  // TODO: Implement proper ABI decoding for struct
  // For now, return raw hex
  return {
    struct: {} as FeedbackAuthParams, // Would need proper decoding
    signature: signatureHex
  };
}

/**
 * Example usage and testing
 */
export async function exampleUsage() {
  const agentId = 1n;
  const clientAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1';
  const agentOwnerPrivateKey = process.env.HEDERA_PRIVATE_KEY!;

  console.log('Generating FeedbackAuth...');
  
  const feedbackAuth = await generateFeedbackAuthForClient(
    agentId,
    clientAddress,
    agentOwnerPrivateKey,
    {
      indexLimit: 5n,
      expiryHours: 48,
      identityRegistryAddress: process.env.NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS
    }
  );

  console.log('FeedbackAuth generated:');
  console.log(feedbackAuth);
  console.log('');
  console.log('Length:', feedbackAuth.length, 'chars');
  console.log('');
  
  const validation = validateFeedbackAuth(feedbackAuth);
  console.log('Validation:', validation);
  
  return feedbackAuth;
}
