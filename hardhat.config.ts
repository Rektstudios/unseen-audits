import 'dotenv/config';
import '@nomicfoundation/hardhat-toolbox';
import '@nomiclabs/hardhat-ethers';
import 'hardhat-gas-reporter';

import { removeConsoleLog } from 'hardhat-preprocessor';

import 'hardhat-deploy';

import type { HardhatUserConfig } from 'hardhat/types';

import 'tsconfig-paths/register';

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
  mocha: {
    timeout: process.env.MOCHA_TIMEOUT ?? 300000,
  },
  networks: {
    hardhat: {
      accounts: {
        count: 100,
      },
    },
  },
  solidity: {
    compilers: [
      {
        version: process.env.SOLC_VERSION ?? '0.8.26',
        settings: {
          viaIR:
            (process.env.SOLIDITY_VIA_IR &&
              process.env.SOLIDITY_VIA_IR.toLowerCase() === 'true') ??
            false,
          optimizer: {
            enabled:
              (process.env.SOLIDITY_OPTIMIZER &&
                process.env.SOLIDITY_OPTIMIZER.toLowerCase() === 'true') ??
              false,
            runs:
              (process.env.SOLIDITY_OPTIMIZER_RUNS &&
                Boolean(parseInt(process.env.SOLIDITY_OPTIMIZER_RUNS)) &&
                parseInt(process.env.SOLIDITY_OPTIMIZER_RUNS)) ??
              200,
          },
        },
      },
    ],
  },
  gasReporter: {
    enabled: !!(
      process.env.REPORT_GAS && process.env.REPORT_GAS.toLowerCase() === 'true'
    ),
    outputFile: './data/gasReport.md',
    coinmarketcap: process.env.COINMARKETCAP_API_KEY ?? '',
    showMethodSig: true,
    showUncalledMethods: false,
    gasPriceApi:
      process.env.GAS_PRICE_API ??
      'https://api.etherscan.io/api?module=proxy&action=eth_gasPrice',
    L1: 'polygon',
    currencyDisplayPrecision: 6,
    currency: process.env.COINMARKETCAP_DEFAULT_CURRENCY ?? 'USD',
  },
  preprocess: {
    eachLine: removeConsoleLog((hre) => hre.network.name !== 'hardhat'),
  },
  typechain: {
    outDir: 'typechained',
    target: 'ethers-v5',
  },
  paths: {
    artifacts: './artifacts',
    cache: './cache',
    sources: './contracts',
    tests: './test',
  },
};

export default config;
