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

  // Normalize: ensure 0x prefix, strip whitespace/quotes
  let key = privateKey.trim().replace(/^["']|["']$/g, '');
  if (!key.startsWith('0x')) {
    key = '0x' + key;
  }

  // Validate: must be 0x + 64 hex chars
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    console.error('ERROR: PRIVATE_KEY is not a valid Ethereum private key.');
    console.error('');
    console.error('It must be a 64-character hex string (with 0x prefix).');
    console.error('Example: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
    console.error('');
    console.error('How to get your private key:');
    console.error('  - MetaMask: Settings > Security > Reveal Private Key');
    console.error('  - Rabby/Coinbase: Export from wallet settings');
    console.error('  - Polymarket email login: Export from https://reveal.magic.link/polymarket');
    console.error('');
    console.error(`Your key starts with: ${key.slice(0, 6)}... and is ${key.length} chars (need 66)`);
    process.exit(1);
  }

  const host = process.env.POLYMARKET_CLOB_ENDPOINT || 'https://clob.polymarket.com';
  const chainId = parseInt(process.env.CHAIN_ID || '137', 10);

  console.log('===========================================');
  console.log(' Polymarket CLOB API Key Generator');
  console.log('===========================================');
  console.log('');

  const wallet = new Wallet(key);
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
