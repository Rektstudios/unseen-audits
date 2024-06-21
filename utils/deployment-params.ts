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
        multisigWallet: '',
        thegenerates: {
          baseTokenUri:
            'https://unseen-nft-staging.fra1.cdn.digitaloceanspaces.com/characters/metadata/',
          contractUri:
            'https://unseen-nft-staging.fra1.cdn.digitaloceanspaces.com/characters/contractUri/0.json',
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
          baseTokenUri:
            'https://unseen-nft-staging.fra1.cdn.digitaloceanspaces.com/characters/metadata/',
          contractUri:
            'https://unseen-nft-staging.fra1.cdn.digitaloceanspaces.com/characters/contractUri/0.json',
          signer: '',
          royaltiesBps: 500,
          rentFeesBps: 500,
        },
      };
    },
  };
};
