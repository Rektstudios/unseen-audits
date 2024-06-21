import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const deployFunction: DeployFunction = async ({
    getNamedAccounts,
    deployments,
    network,
}: HardhatRuntimeEnvironment) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    log("----------------------------------------------------")
    log(
        `Deploying Unseen Vesting NFT Descriptor on ${network.name} Chain and waiting for confirmations...`
    )
    const vestingNFTDescriptor = await deploy("UnseenVestingNFTDescriptor", {
        from: deployer,
        args: [],
        log: true,
        waitConfirmations: 1,
    })
    log(`Unseen Vesting NFT Descriptor at ${vestingNFTDescriptor.address}`)
}

deployFunction.tags = ["All", "Vesting", "VestingNFTDescriptor"]
export default deployFunction
