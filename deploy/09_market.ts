
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
  const registry = await get('UnseenRegistry');
  const networkConfigured = await (await networkConfig())[network.name]();
  const config = networkConfigured.marketplace;
  log('----------------------------------------------------');
  log(
    `Deploying Unseen Marketplace on ${network.name} Chain and waiting for confirmations...`
  );
  const args = [
    [registry.address],
    networkConfigured.multisigWallet || deployer,
    deployer,
    config.feesBps,
  ];
  const marketplace = await deploy('UnseenExchange', {
    from: deployer,
    args,
    log: true,
    waitConfirmations: networkConfigured.blockConfirmations || 1,
  });
  log(`Unseen Marketplace at ${marketplace.address}`);

};

deployFunction.tags = ['All', 'UnseenMarket', 'UnseenExchange'];
export default deployFunction;
