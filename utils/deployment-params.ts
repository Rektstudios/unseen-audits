interface networkConfigType {
  [key: string]: any;
}
export const networkConfig: () => Promise<networkConfigType> = async () => {
  return {
    localhost: async () => {
      return {
        marketplace: {
          feesBps: 250,
        },
        uncn: {
          interchainTokenServiceAddress: '',
          initialSupply: 1_000_000_000,
        },
        multisigWallet: '',
        thegenerates: {
          baseTokenUri: 'https://example.com/characters/metadata/',
          contractUri: 'https://example.com/characters/contractUri/0.json',
          signer: '',
          royaltiesBps: 500,
          rentFeesBps: 500,
        },
      };
    },
    hardhat: async () => {
      return {
        marketplace: {
          feesBps: 250,
        },
        uncn: {
          interchainTokenServiceAddress: '',
          initialSupply: 1_000_000_000,
        },
        multisigWallet: '',
        thegenerates: {
          baseTokenUri: 'https://example.com/characters/metadata/',
          contractUri: 'https://example.com/characters/contractUri/0.json',
          signer: '',
          royaltiesBps: 500,
          rentFeesBps: 500,
        },
      };
    },
  };
};
