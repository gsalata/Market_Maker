/**
 * Generate Polymarket CLOB API credentials from your private key.
 *
 * Usage:
 *   npm run generate-key
 *
 * Prerequisites:
 *   - Set PRIVATE_KEY in your .env file
 *
 * After running, copy the output values into your .env file.
 */

import dotenv from 'dotenv';
dotenv.config();

import { ClobClient } from '@polymarket/clob-client';
import { Wallet } from '@ethersproject/wallet';

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey || privateKey === '0xYOUR_PRIVATE_KEY_HERE' || privateKey === 'test-key') {
    console.error('ERROR: Set a valid PRIVATE_KEY in your .env file first.');
    console.error('');
    console.error('Steps:');
    console.error('  1. cp .env.example .env');
    console.error('  2. Edit .env and paste your private key');
    console.error('  3. Run this script again: npm run generate-key');
    process.exit(1);
  }

  const host = process.env.POLYMARKET_CLOB_ENDPOINT || 'https://clob.polymarket.com';
  const chainId = parseInt(process.env.CHAIN_ID || '137', 10);

  console.log('===========================================');
  console.log(' Polymarket CLOB API Key Generator');
  console.log('===========================================');
  console.log('');

  const wallet = new Wallet(privateKey);
  console.log(`Wallet address: ${wallet.address}`);
  console.log(`CLOB endpoint:  ${host}`);
  console.log(`Chain ID:       ${chainId}`);
  console.log('');
  console.log('Deriving API credentials...');

  const tempClient = new ClobClient(host, chainId, wallet);
  const creds = await tempClient.createOrDeriveApiKey();

  console.log('');
  console.log('SUCCESS! Add these to your .env file:');
  console.log('');
  console.log(`CLOB_API_KEY=${creds.key}`);
  console.log(`CLOB_SECRET=${creds.secret}`);
  console.log(`CLOB_PASSPHRASE=${creds.passphrase}`);
  console.log('');
  console.log('===========================================');
}

main().catch((err) => {
  console.error('Failed to generate API key:', err.message || err);
  process.exit(1);
});
