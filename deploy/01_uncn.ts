import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import type { DeployFunction } from 'hardhat-deploy/types';
import { networkConfig } from 'utils/deployment-params';

const deployFunction: DeployFunction = async ({
  getNamedAccounts,
  deployments,
  network,
}: HardhatRuntimeEnvironment) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const networkConfigured = await (await networkConfig())[network.name]();
  const uncnConfig = networkConfigured.uncn;
  log('----------------------------------------------------');
  log(
    `Deploying Unseen governance token on ${network.name} Chain and waiting for confirmations...`
  );
  const args = [networkConfigured.multisigWallet || deployer];
  const unseenToken = await deploy('UnseenToken', {
    from: deployer,
    args,
    log: true,
    waitConfirmations: 1,
  });
  log(`Unseen Governance token at ${unseenToken.address}`);
};

deployFunction.tags = ['All', 'Vesting', 'UnseenToken'];
export default deployFunction;
