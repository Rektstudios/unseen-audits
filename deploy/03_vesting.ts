import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import type { DeployFunction } from 'hardhat-deploy/types';

const deployFunction: DeployFunction = async ({
  getNamedAccounts,
  deployments,
  network,
}: HardhatRuntimeEnvironment) => {
  const { deploy, log, get } = deployments;
  const { deployer } = await getNamedAccounts();
  const uncn = await get('UnseenToken');
  const vestingDescriptor = await get('UnseenVestingNFTDescriptor');
  log('----------------------------------------------------');
  log(
    `Deploying Unseen Vesting on ${network.name} Chain and waiting for confirmations...`
  );
  const args = [
    deployer,
    vestingDescriptor.address,
    300,
    uncn.address,
  ];
  const vesting = await deploy('UnseenVesting', {
    from: deployer,
    args,
    log: true,
    waitConfirmations: 1,
  });
  log(`Unseen Vesting at ${vesting.address}`);
};

deployFunction.tags = ['All', 'Vesting', 'UnseenVesting'];
export default deployFunction;
