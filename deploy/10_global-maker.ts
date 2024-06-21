import { globalMakerSigMakerOffsets } from '../constants';
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
  log('----------------------------------------------------');
  log(
    `Deploying global maker contract on ${network.name} Chain and waiting for confirmations...`
  );
  const args = [
    registry.address,
    globalMakerSigMakerOffsets.map((a) => a.sig),
    globalMakerSigMakerOffsets.map((a) => a.offset),
  ];
  const globalMaker = await deploy('GlobalMaker', {
    from: deployer,
    args,
    log: true,
    waitConfirmations: networkConfigured.blockConfirmations || 1,
  });
  log(`Global Maker contract at ${globalMaker.address}`);
};

deployFunction.tags = ['All', 'UnseenMarket', 'GlobalMaker'];
export default deployFunction;
