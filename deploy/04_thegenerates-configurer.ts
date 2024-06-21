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
    `Deploying TheGenerates configurer on ${network.name} Chain and waiting for confirmations...`
  );
  const thegeneratesConfigurer = await deploy('TheGeneratesConfigurer', {
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: networkConfigured.blockConfirmations || 1,
  });
  log(`TheGenerates configurer at ${thegeneratesConfigurer.address}`);
};

deployFunction.tags = ['All', 'Characters', 'TheGeneratesConfiguror'];
export default deployFunction;
