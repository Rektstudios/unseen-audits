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
  log('----------------------------------------------------');
  log(
    `Deploying Unseen Atomicizer on ${network.name} Chain and waiting for confirmations...`
  );
  const Atomicizer = await deploy('UnseenAtomicizer', {
    from: deployer,
    args: [],
    log: true,
    waitConfirmations:
      (await (await networkConfig())[network.name]().blockConfirmations) || 1,
  });
  log(`Unseen Atomicizer at ${Atomicizer.address}`);
};

deployFunction.tags = ['All', 'UnseenMarket', 'UnseenAtomicizer'];
export default deployFunction;
