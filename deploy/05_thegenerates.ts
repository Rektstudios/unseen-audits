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
  const configuror = await get('TheGeneratesConfigurer');
  const networkConfigured = await (await networkConfig())[network.name]();
  const args = [
    configuror.address,
    deployer,
  ];
  log('----------------------------------------------------');
  log(
    `Deploying TheGenerates nft characters on ${network.name} Chain and waiting for confirmations...`
  );
  const thegenerates = await deploy('TheGenerates', {
    from: deployer,
    args,
    log: true,
    waitConfirmations: networkConfigured.blockConfirmations || 1,
  });
  log(`TheGenerates nft characters at ${thegenerates.address}`);
};

deployFunction.tags = ['All', 'Characters', 'TheGenerates'];
export default deployFunction;
