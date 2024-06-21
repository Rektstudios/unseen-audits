import { networkConfig } from '../utils/deployment-params';

import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import type { DeployFunction } from 'hardhat-deploy/types';

const deployFunction: DeployFunction = async ({
  getNamedAccounts,
  deployments,
  network,
}: HardhatRuntimeEnvironment) => {
  const { deploy, log, get } = deployments;
  const { deployer } = await getNamedAccounts();
  const atomicizer = await get('UnseenAtomicizer');
  log('----------------------------------------------------');
  log(
    `Deploying Unseen Static Market on ${network.name} and waiting for confirmations...`
  );
  const staticMarket = await deploy('UnseenStatic', {
    from: deployer,
    args: [atomicizer.address],
    log: true,
    waitConfirmations:
      (await (await networkConfig())[network.name]().blockConfirmations) || 1,
  });
  log(`Unseen Nft Static Market at ${staticMarket.address}`);
};

deployFunction.tags = ['All', 'UnseenMarket', 'UnseenStatic'];
export default deployFunction;
