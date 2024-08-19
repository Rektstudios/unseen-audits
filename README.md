![Unseen](img/Unseen-banner.png)
<br />

<h1 align="center">Unseen Contracts</h1>
<p align="center">
<a href="https://github.com/Rektstudios/unseen-audits/actions"><img alt="Build Status" src="https://github.com/Rektstudios/unseen-audits/actions/workflows/tests.yml/badge.svg"/></a>
<a href="https://discord.gg/playunseen"><img alt="Join our Discord!" src="https://img.shields.io/discord/1245267126089154671.svg?color=7289da&label=discord&logo=discord&style=flat"/></a>
</p>
<p align="center"><strong>Collection of smart contracts powering Unseen platform</strong></p>

## Installation

```bash
contracts
|
|-- extensions: "extensions that can be inherited by contracts"
|   |-- ERC4907A: "Extended ERC721A extension to add time-limited role"
|
|-- fee-collector: "unseen fees collector contract"
|   |-- BaseFeeCollector: "Allows Native and ERC20 tokens withdrawal"
|   |-- FeeCollector: "Contract that inherits the BaseFeeCollector"
|
|-- marketplace: "exchange contract that can trade any digital asset"
|   |-- exchange: "contract to match orders"
|   |-- registry: "authenticated proxies for traders"
|   |-- static: "predicate functions used for validations"
|   |-- atomicizer: "contract to execute calls atomically"
|   |-- globalmaker: "shared authenticated proxy"
|
|-- thegenerates: "unseen characters contract"
|   |-- thegenerates: "ERC721A token contract"
|   |-- thegenerates-configuror: "helper contract to configure TheGenerates parameters"
|
|-- uncn: "unseen token powering the platform products"
|
|-- vesting: "unseen vesting protocol to distribute tokens"
|   |-- unseen-vesting-nft-descriptor: "the vesting schedule metadata onchain"
|   |-- unseen-vesting: "contract that manages uncn distribution"
|
|-- lib: "Solidity libraries"
|
|-- mock: "testing contracts"
```

## Running Tests

1. `yarn`: install contracts dependencies
2. `yarn test`: run the tests

This repository is a [hardhat](https://github.com/NomicFoundation/hardhat/tree/main) project.

First install the relevant dependencies of the project:

```bash
yarn
```

To compile contracts, run:

```bash
yarn compile
```

To run tests:

```bash
yarn test
```

## Contracts Audit

- [Certik](audit-reports/certik.pdf)

## Rekt Studios Vesting License :
- https://app.ens.domains/v2-core-license-grants.sablier.eth?tab=records

## Bug reports

Found a security issue with our smart contracts? Send bug reports to security@playunseen.com and we'll continue communicating with you from there. We're actively developing a bug bounty program; bug report payouts happen on a case by case basis, for now.

## Feedback

If you have any feedback, please reach out to us at support@playunseen.com.

## Authors

- [unseen](https://playunseen.com)

## License

[Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0.txt)