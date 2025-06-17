# app

This starter full stack project has been generated using AlgoKit. See below for default getting started instructions.


### Screenshots

![Project Screenshot 1](screenshots/screenshot1.png)
![Project Screenshot 2](screenshots/screenshot2.png)

# 🎮 Recoverable NFTs for Game Items - AlgoRealm

> 🥉 3rd Prize Winner — Algorand Live-Hack
> 
> A secure, identity-linked NFT recovery system for gamers built on Algorand using AlgoKit and PyTEAL.

---

## 🚀 Overview

**AlgoRealm** solves a critical problem in Web3 gaming: **lost NFTs due to wallet loss.**

We built a smart contract system that lets players **recover lost NFTs** by linking game assets to an **App ID (identity)** instead of just a wallet. If a player loses access to their wallet, they can still **verify their identity** and reclaim their NFTs securely.

---

## 🎯 Key Features

- ✅ NFT minting on in-game item purchases  
- 🔁 Recover lost NFTs via identity + quest proof  
- 🛠️ Craft new items by combining existing ones  
- 🧙‍♂️ Game Master can issue seasonal items  
- 🔐 On-chain player registration and tracking  
- 📦 IPFS / ARC-69 support for NFT metadata  
- 🔒 Security: Multisig roles & identity-linked recovery

---

## 🧠 Problem It Solves

> In Web3 gaming, users often lose access to rare NFTs if they lose their wallet or private key.  
> AlgoRealm fixes this by allowing NFTs to be recovered using App ID and player authentication, ensuring **true digital ownership**.

---

## 🧩 Tech Stack

| Layer              | Tech                                |
|--------------------|--------------------------------------|
| 🖼 Frontend         | React.js + Tailwind CSS              |
| 🔒 Smart Contracts  | PyTEAL (via AlgoKit)                 |
| 🔗 Blockchain       | Algorand                             |
| 🆔 Identity Layer   | App ID (custom) + future DID-ready   |
| 🎨 NFT Standards    | ARC3, ARC69                          |
| 📂 Storage          | IPFS                                 |

---

## ⚙️ Smart Contract Highlights

- Written in **ARC4 standard** using `algopy`
- Uses local/global state for player/item tracking
- Implements:
  - `register_player()`
  - `create_game_item()`
  - `recover_lost_item()`
  - `seasonal_event_reissue()`
  - `craft_items()`
  - `claim_item()`
  - and more...

## Setup

### Initial setup
1. Clone this repository to your local machine.
2. Ensure [Docker](https://www.docker.com/) is installed and operational. Then, install `AlgoKit` following this [guide](https://github.com/algorandfoundation/algokit-cli#install).
3. Run `algokit project bootstrap all` in the project directory. This command sets up your environment by installing necessary dependencies, setting up a Python virtual environment, and preparing your `.env` file.
4. In the case of a smart contract project, execute `algokit generate env-file -a target_network localnet` from the `app-contracts` directory to create a `.env.localnet` file with default configuration for `localnet`.
5. To build your project, execute `algokit project run build`. This compiles your project and prepares it for running.
6. For project-specific instructions, refer to the READMEs of the child projects:
   - Smart Contracts: [app-contracts](projects/app-contracts/README.md)
   - Frontend Application: [app-frontend](projects/app-frontend/README.md)

> This project is structured as a monorepo, refer to the [documentation](https://github.com/algorandfoundation/algokit-cli/blob/main/docs/features/project/run.md) to learn more about custom command orchestration via `algokit project run`.

### Subsequently

1. If you update to the latest source code and there are new dependencies, you will need to run `algokit project bootstrap all` again.
2. Follow step 3 above.

### Continuous Integration / Continuous Deployment (CI/CD)

This project uses [GitHub Actions](https://docs.github.com/en/actions/learn-github-actions/understanding-github-actions) to define CI/CD workflows, which are located in the [`.github/workflows`](./.github/workflows) folder. You can configure these actions to suit your project's needs, including CI checks, audits, linting, type checking, testing, and deployments to TestNet.

For pushes to `main` branch, after the above checks pass, the following deployment actions are performed:
  - The smart contract(s) are deployed to TestNet using [AlgoNode](https://algonode.io).
  - The frontend application is deployed to a provider of your choice (Netlify, Vercel, etc.). See [frontend README](frontend/README.md) for more information.

> Please note deployment of smart contracts is done via `algokit deploy` command which can be invoked both via CI as seen on this project, or locally. For more information on how to use `algokit deploy` please see [AlgoKit documentation](https://github.com/algorandfoundation/algokit-cli/blob/main/docs/features/deploy.md).

## Tools

This project makes use of Python and React to build Algorand smart contracts and to provide a base project configuration to develop frontends for your Algorand dApps and interactions with smart contracts. The following tools are in use:

- Algorand, AlgoKit, and AlgoKit Utils
- Python dependencies including Poetry, Black, Ruff or Flake8, mypy, pytest, and pip-audit
- React and related dependencies including AlgoKit Utils, Tailwind CSS, daisyUI, use-wallet, npm, jest, playwright, Prettier, ESLint, and Github Actions workflows for build validation

### VS Code

It has also been configured to have a productive dev experience out of the box in [VS Code](https://code.visualstudio.com/), see the [backend .vscode](./backend/.vscode) and [frontend .vscode](./frontend/.vscode) folders for more details.

## Integrating with smart contracts and application clients

Refer to the [app-contracts](projects/app-contracts/README.md) folder for overview of working with smart contracts, [projects/app-frontend](projects/app-frontend/README.md) for overview of the React project and the [projects/app-frontend/contracts](projects/app-frontend/src/contracts/README.md) folder for README on adding new smart contracts from backend as application clients on your frontend. The templates provided in these folders will help you get started.
When you compile and generate smart contract artifacts, your frontend component will automatically generate typescript application clients from smart contract artifacts and move them to `frontend/src/contracts` folder, see [`generate:app-clients` in package.json](projects/app-frontend/package.json). Afterwards, you are free to import and use them in your frontend application.

The frontend starter also provides an example of interactions with your HelloWorldClient in [`AppCalls.tsx`](projects/app-frontend/src/components/AppCalls.tsx) component by default.

## Next Steps

You can take this project and customize it to build your own decentralized applications on Algorand. Make sure to understand how to use AlgoKit and how to write smart contracts for Algorand before you start.
