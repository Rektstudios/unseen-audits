import { networkConfig } from '../utils/deployment-params';

import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import type { DeployFunction } from 'hardhat-deploy/types';

const deployFunction: DeployFunction = async ({
  getNamedAccounts,
  deployments,
  network,
}: HardhatRuntimeEnvironment) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const networkConfigured = await (await networkConfig())[network.name]();
  log('----------------------------------------------------');
  log(
    `Deploying Unseen Marketplace Registry on ${network.name} Chain and waiting for confirmations...`
  );
  const args = [networkConfigured.multisigWallet || deployer];
  const Registry = await deploy('UnseenRegistry', {
    from: deployer,
    args,
    log: true,
    waitConfirmations: networkConfigured.blockConfirmations || 1,
    contract: 'contracts/marketplace/UnseenRegistry.sol:UnseenRegistry',
  });
  log(`Unseen Marketplace Registry at ${Registry.address}`);
};

deployFunction.tags = ['All', 'UnseenMarket', 'UnseenRegistry'];
export default deployFunction;
