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
    `Deploying Unseen fee collector contract on ${network.name} Chain and waiting for confirmations...`
  );
  const args = [networkConfigured.multisigWallet || deployer];
  const feeCollector = await deploy('FeeCollector', {
    from: deployer,
    args,
    log: true,
    waitConfirmations: networkConfigured.blockConfirmations || 1,
  });
  log(`Unseen fee collector contract at ${feeCollector.address}`);
};

deployFunction.tags = ['All', 'FeeCollector'];
export default deployFunction;
