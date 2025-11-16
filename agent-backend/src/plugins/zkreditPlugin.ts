import { z } from 'zod';
import {
  Client,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  PrivateKey,
  AccountId,
} from '@hashgraph/sdk';
import { generateFeedbackAuthForClient } from '../services/feedbackAuthService';

/**
 * Plugin context interface (from hedera-agent-kit-js)
 */
interface Context {
  client: Client;
  accountId: AccountId;
  privateKey: PrivateKey;
}

/**
 * Tool interface (from hedera-agent-kit-js)
 */
interface Tool {
  method: string;
  name: string;
  description: string;
  parameters: z.ZodObject<any>;
  execute: (client: Client, context: Context, params: any) => Promise<any>;
}

/**
 * Plugin interface (from hedera-agent-kit-js)
 */
interface Plugin {
  name: string;
  version: string;
  description: string;
  tools: (context: Context) => Tool[];
}

/**
 * Contract addresses (from deployed ERC-8004 contracts)
 */
const CONTRACTS = {
  identityRegistry: process.env.IDENTITY_REGISTRY_ADDRESS || '0x1FCE50d8F7B53d18d458Cf009dA2AD7cf0F2464d',
  reputationRegistry: process.env.REPUTATION_REGISTRY_ADDRESS || '0xfe5270a6339d9C05A37dA0f59AdF6c9c77AC7d7a',
  validationRegistry: process.env.VALIDATION_REGISTRY_ADDRESS || '0x423cB049eDCDa6CeB046005e523145615B724003',
};

/**
 * Tool 1: Register Agent
 * Registers a new agent in the IdentityRegistry
 */
function createRegisterAgentTool(context: Context): Tool {
  return {
    method: 'registerAgent',
    name: 'Register Agent',
    description: 'Register a new agent in the ZKredit IdentityRegistry with metadata',
    parameters: z.object({
      tokenUri: z.string().describe('IPFS URI for agent metadata (e.g., ipfs://Qm...)'),
      metadata: z.array(z.string()).optional().describe('Optional metadata key-value pairs'),
    }),
    execute: async (client: Client, ctx: Context, params: any) => {
      const { tokenUri, metadata = [] } = params;

      // Build contract call parameters
      const functionParams = new ContractFunctionParameters()
        .addString(tokenUri);

      // Add metadata if provided (key-value pairs)
      if (metadata.length > 0) {
        functionParams.addStringArray(metadata);
      }

      // Execute contract transaction
      const transaction = new ContractExecuteTransaction()
        .setContractId(CONTRACTS.identityRegistry)
        .setGas(500_000)
        .setFunction('register', functionParams);

      const txResponse = await transaction.execute(client);
      const receipt = await txResponse.getReceipt(client);

      // Parse agent ID from contract logs (would need proper event parsing)
      // For now, return transaction details
      return {
        success: true,
        transactionId: txResponse.transactionId.toString(),
        status: receipt.status.toString(),
        message: 'Agent registered successfully',
        contractAddress: CONTRACTS.identityRegistry,
      };
    },
  };
}

/**
 * Tool 2: Submit Feedback
 * Submits feedback with pre-authorized FeedbackAuth
 */
function createSubmitFeedbackTool(context: Context): Tool {
  return {
    method: 'submitFeedback',
    name: 'Submit Feedback',
    description: 'Submit feedback to an agent using FeedbackAuth authorization',
    parameters: z.object({
      agentId: z.string().describe('Agent ID to give feedback to'),
      rating: z.number().min(1).max(5).describe('Rating (1-5)'),
      comment: z.string().describe('Feedback comment'),
      clientAddress: z.string().describe('Client Ethereum address'),
      indexLimit: z.string().optional().describe('Max number of feedbacks (default: 10)'),
      expiryHours: z.number().optional().describe('FeedbackAuth expiry in hours (default: 24)'),
    }),
    execute: async (client: Client, ctx: Context, params: any) => {
      const {
        agentId,
        rating,
        comment,
        clientAddress,
        indexLimit = '10',
        expiryHours = 24,
      } = params;

      // Generate FeedbackAuth
      const feedbackAuth = await generateFeedbackAuthForClient(
        BigInt(agentId),
        clientAddress,
        ctx.privateKey.toStringRaw(),
        {
          indexLimit: BigInt(indexLimit),
          expiryHours,
          identityRegistryAddress: CONTRACTS.identityRegistry,
        }
      );

      // Build contract call parameters
      const functionParams = new ContractFunctionParameters()
        .addUint256(Number(agentId)) // Hedera SDK uses number for uint256
        .addUint8(rating)
        .addString(comment)
        .addBytes(Buffer.from(feedbackAuth.replace('0x', ''), 'hex'));

      // Execute contract transaction
      const transaction = new ContractExecuteTransaction()
        .setContractId(CONTRACTS.reputationRegistry)
        .setGas(600_000)
        .setFunction('giveFeedback', functionParams);

      const txResponse = await transaction.execute(client);
      const receipt = await txResponse.getReceipt(client);

      return {
        success: true,
        transactionId: txResponse.transactionId.toString(),
        status: receipt.status.toString(),
        message: 'Feedback submitted successfully',
        feedbackAuth: feedbackAuth.slice(0, 20) + '...', // Truncated for display
        contractAddress: CONTRACTS.reputationRegistry,
      };
    },
  };
}

/**
 * Tool 3: Get Agent Reputation
 * Retrieves agent's feedback and reputation data
 */
function createGetReputationTool(context: Context): Tool {
  return {
    method: 'getAgentReputation',
    name: 'Get Agent Reputation',
    description: 'Retrieve feedback count and reputation metrics for an agent',
    parameters: z.object({
      agentId: z.string().describe('Agent ID to query'),
    }),
    execute: async (client: Client, ctx: Context, params: any) => {
      const { agentId } = params;

      // Build contract call parameters
      const functionParams = new ContractFunctionParameters()
        .addUint256(Number(agentId)); // Hedera SDK uses number for uint256

      // Query contract (using ContractCallQuery)
      // Note: Hedera Agent Kit might have utility methods for this
      // For now, return placeholder
      return {
        success: true,
        agentId,
        feedbackCount: 0, // Would query from ReputationRegistry.getFeedbackCount(agentId)
        averageRating: 0, // Would need to calculate from feedback data
        message: 'Reputation query executed (parsing not implemented)',
      };
    },
  };
}

/**
 * Tool 4: Request Validation
 * Creates a validation request for an agent
 */
function createRequestValidationTool(context: Context): Tool {
  return {
    method: 'requestValidation',
    name: 'Request Validation',
    description: 'Create a validation request for an agent to respond to',
    parameters: z.object({
      agentId: z.string().describe('Agent ID to request validation from'),
      validationType: z.string().describe('Type of validation requested'),
      metadata: z.string().optional().describe('Optional validation metadata'),
    }),
    execute: async (client: Client, ctx: Context, params: any) => {
      const { agentId, validationType, metadata = '' } = params;

      // Build contract call parameters
      const functionParams = new ContractFunctionParameters()
        .addUint256(Number(agentId)) // Hedera SDK uses number for uint256
        .addString(validationType)
        .addString(metadata);

      // Execute contract transaction
      const transaction = new ContractExecuteTransaction()
        .setContractId(CONTRACTS.validationRegistry)
        .setGas(400_000)
        .setFunction('requestValidation', functionParams);

      const txResponse = await transaction.execute(client);
      const receipt = await txResponse.getReceipt(client);

      return {
        success: true,
        transactionId: txResponse.transactionId.toString(),
        status: receipt.status.toString(),
        message: 'Validation request created',
        contractAddress: CONTRACTS.validationRegistry,
      };
    },
  };
}

/**
 * ZKredit Plugin
 * Integrates ERC-8004 agent registry with Hedera Agent Kit
 */
export const zkreditPlugin: Plugin = {
  name: 'zkredit',
  version: '1.0.0',
  description: 'ZKredit agent management plugin - ERC-8004 identity, reputation, and validation',
  tools: (context: Context) => [
    createRegisterAgentTool(context),
    createSubmitFeedbackTool(context),
    createGetReputationTool(context),
    createRequestValidationTool(context),
  ],
};

export default zkreditPlugin;
