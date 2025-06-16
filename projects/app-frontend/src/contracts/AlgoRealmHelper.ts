import { AlgorandClient } from '@algorandfoundation/algokit-utils/types/algorand-client'
import { TransactionSigner } from 'algosdk'
import { AlgoRealmGameManagerClient } from './AlgoRealmGameManager'
import deploymentInfo from './deployment_info.json'

/**
 * Helper class to interact with the deployed AlgoRealm Game Manager contract
 */
export class AlgoRealmHelper {
  private client: AlgoRealmGameManagerClient | null = null
  private algorand: AlgorandClient | null = null
  private signer: TransactionSigner | null = null

  /**
   * Initialize the client with the deployed contract
   */
  async initialize(algorand: AlgorandClient, sender?: string, signer?: TransactionSigner): Promise<AlgoRealmGameManagerClient> {
    this.algorand = algorand
    this.signer = signer || null

    this.client = new AlgoRealmGameManagerClient({
      algorand,
      appId: BigInt(deploymentInfo.app_id),
      defaultSender: sender || '',
    })

    return this.client
  }

  /**
   * Get the client instance (must call initialize first)
   */
  getClient(): AlgoRealmGameManagerClient {
    if (!this.client) {
      throw new Error('Client not initialized. Call initialize() first.')
    }
    return this.client
  }

  /**
   * Check if signer is available
   */
  private ensureSigner(): TransactionSigner {
    if (!this.signer) {
      throw new Error('No signer available. Make sure wallet is connected.')
    }
    return this.signer
  }

  /**
   * Get deployment information
   */
  getDeploymentInfo() {
    return deploymentInfo
  }

  /**
   * Register a new player (requires opt-in first)
   */
  async registerPlayer(playerName: string, sender: string) {
    const client = this.getClient()
    const signer = this.ensureSigner()

    // Ensure account is funded before attempting transactions
    await this.ensureAccountFunded(sender)

    // First, opt-in to the application
    await client.send.optIn.registerPlayer({
      args: { playerName },
      sender,
      signer,
    })

    // Then register the player
    return await client.send.registerPlayer({
      args: { playerName },
      sender,
      signer,
    })
  }

  /**
   * Create a new game item (Game Master only)
   */
  async createGameItem(
    recipient: string,
    itemName: string,
    itemType: string,
    rarity: string,
    attackPower: number,
    defensePower: number,
    specialEffect: string,
    sender: string,
  ) {
    const client = this.getClient()
    const signer = this.ensureSigner()

    return await client.send.createGameItem({
      args: {
        recipient,
        itemName,
        itemType,
        rarity,
        attackPower: BigInt(attackPower),
        defensePower: BigInt(defensePower),
        specialEffect,
      },
      sender,
      signer,
    })
  }

  /**
   * Recover a lost item
   */
  async recoverLostItem(originalItemId: bigint, recoveryQuestProof: Uint8Array, newRecipient: string, sender: string) {
    const client = this.getClient()
    const signer = this.ensureSigner()

    return await client.send.recoverLostItem({
      args: {
        originalItemId,
        recoveryQuestProof,
        newRecipient,
      },
      sender,
      signer,
    })
  }

  /**
   * Issue seasonal event item
   */
  async seasonalEventReissue(eventName: string, participationProof: Uint8Array, recipient: string, sender: string) {
    const client = this.getClient()
    const signer = this.ensureSigner()

    return await client.send.seasonalEventReissue({
      args: {
        eventName,
        participationProof,
        recipient,
      },
      sender,
      signer,
    })
  }

  /**
   * Craft new items from existing ones
   */
  async craftItems(material1: bigint, material2: bigint, recipeId: number, sender: string) {
    const client = this.getClient()
    const signer = this.ensureSigner()

    return await client.send.craftItems({
      args: {
        material_1: material1,
        material_2: material2,
        recipeId: BigInt(recipeId),
      },
      sender,
      signer,
    })
  }

  /**
   * Get player statistics
   */
  async getPlayerStats(player: string): Promise<[bigint, bigint, bigint]> {
    const client = this.getClient()

    const result = await client.send.getPlayerStats({
      args: { player },
      sender: player,
    })

    return result.return as [bigint, bigint, bigint]
  }

  /**
   * Advance season (Game Master only)
   */
  async advanceSeason(sender: string) {
    const client = this.getClient()
    const signer = this.ensureSigner()

    return await client.send.advanceSeason({
      args: [],
      sender,
      signer,
    })
  }

  /**
   * Get game information
   */
  async getGameInfo(): Promise<[bigint, bigint, bigint]> {
    const client = this.getClient()

    const result = await client.send.getGameInfo({
      args: [],
    })

    return result.return as [bigint, bigint, bigint]
  }

  /**
   * Get global state shorthand methods
   */
  async getTotalPlayers(): Promise<bigint | undefined> {
    const client = this.getClient()
    return await client.state.global.totalPlayers()
  }

  async getTotalItemsCreated(): Promise<bigint | undefined> {
    const client = this.getClient()
    return await client.state.global.totalItemsCreated()
  }

  async getCurrentSeason(): Promise<bigint | undefined> {
    const client = this.getClient()
    return await client.state.global.currentSeason()
  }

  async getGameMaster(): Promise<string | undefined> {
    const client = this.getClient()
    return await client.state.global.gameMaster()
  }

  /**
   * Get local state for a player
   */
  async getPlayerLevel(player: string): Promise<bigint | undefined> {
    const client = this.getClient()
    return await client.state.local(player).playerLevel()
  }

  async getPlayerExperience(player: string): Promise<bigint | undefined> {
    const client = this.getClient()
    return await client.state.local(player).playerExperience()
  }

  async getPlayerRecoveryCount(player: string): Promise<bigint | undefined> {
    const client = this.getClient()
    return await client.state.local(player).playerRecoveryCount()
  }

  async isPlayerRegistered(player: string): Promise<boolean> {
    const client = this.getClient()
    const isRegistered = await client.state.local(player).isRegistered()
    return isRegistered === true
  }

  /**
   * Check if an address is the game master
   */
  isGameMaster(address: string): boolean {
    return address === deploymentInfo.game_master
  }

  /**
   * Get the game master address
   */
  getGameMasterAddress(): string {
    return deploymentInfo.game_master
  }

  /**
   * Get the contract app ID
   */
  getAppId(): number {
    return deploymentInfo.app_id
  }

  /**
   * Get the contract app address
   */
  getAppAddress(): string {
    return deploymentInfo.app_address
  }

  /**
   * Ensure account is funded (for LocalNet development)
   */
  async ensureAccountFunded(address: string, minBalance: number = 1): Promise<void> {
    if (!this.algorand) {
      throw new Error('Algorand client not initialized')
    }

    try {
      const accountInfo = await this.algorand.account.getInformation(address)
      const currentBalance = Number(accountInfo.balance) / 1_000_000 // Convert microAlgos to Algos

      if (currentBalance < minBalance) {
        // console.log(`Account balance (${currentBalance} ALGO) is low, needs funding...`)

        // Check if we're on LocalNet
        const isLocalNet = import.meta.env.VITE_ALGOD_NETWORK === 'localnet'

        if (isLocalNet) {
          throw new Error(`LocalNet Account Funding Required:

Your account ${address} has insufficient funds (${currentBalance} ALGO).

To fund your account in LocalNet:
1. Use AlgoKit dispenser: Run "algokit dispenser fund --address ${address}" in terminal
2. Or import a pre-funded LocalNet account in your wallet (like Defly or Pera)
3. Or reset LocalNet: Run "algokit localnet reset" to get fresh pre-funded accounts

Current balance: ${currentBalance} ALGO, Required: ${minBalance} ALGO`)
        } else {
          throw new Error(
            `Account ${address} needs funding. Current balance: ${currentBalance} ALGO. Please fund the account and try again.`,
          )
        }
      }
    } catch (error) {
      if (error instanceof Error && (error.message.includes('needs funding') || error.message.includes('Funding Required'))) {
        throw error
      }
      throw new Error(`Could not check account balance: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get all game items (assets) owned by a specific account
   */
  async getUserAssets(accountAddress: string) {
    if (!this.algorand) {
      throw new Error('Algorand client not initialized')
    }

    try {
      const accountInfo = await this.algorand.client.algod.accountInformation(accountAddress).do()

      // Get all assets owned by the user
      const userAssets = accountInfo.assets || []

      if (userAssets.length === 0) {
        return []
      }

      // Get detailed information about each asset
      const detailedAssets = await Promise.all(
        userAssets.map(async (asset) => {
          try {
            const assetId = asset.assetId
            const assetInfo = await this.algorand!.client.algod.getAssetByID(assetId).do()

            const deploymentInfo = this.getDeploymentInfo()
            const isGameItem =
              assetInfo.params.manager === deploymentInfo.app_address ||
              assetInfo.params.creator === deploymentInfo.app_address ||
              ['ALGITEM', 'ALGRECOV', 'ALGSEASN', 'ALGCRAFT'].includes(assetInfo.params.unitName || '')

            // Extract ownership information from the metadata fields
            let owner = null
            let isOwner = false
            let ownerAddress = null

            // Check for ownership in the URL field, which we can use to store metadata
            if (assetInfo.params.url) {
              const urlValue = assetInfo.params.url
              // Check if this URL might contain ownership info
              if (urlValue.includes('OWNER:')) {
                try {
                  const ownerMatch = urlValue.match(/OWNER:([a-zA-Z0-9]+)/)
                  if (ownerMatch && ownerMatch[1]) {
                    ownerAddress = ownerMatch[1]
                    isOwner = ownerAddress === accountAddress
                    owner = ownerAddress
                  }
                } catch (e) {
                  // Ignore parsing errors
                }
              }
            }

            // Also check the name field, which might contain ownership info in some items
            if (!owner && assetInfo.params.name) {
              const nameValue = assetInfo.params.name
              if (nameValue.includes('OWNER:')) {
                try {
                  const ownerMatch = nameValue.match(/OWNER:([a-zA-Z0-9]+)/)
                  if (ownerMatch && ownerMatch[1]) {
                    ownerAddress = ownerMatch[1]
                    isOwner = ownerAddress === accountAddress
                    owner = ownerAddress
                  }
                } catch (e) {
                  // Ignore parsing errors
                }
              }
            }

            return {
              id: assetId,
              assetId: assetId,
              amount: asset.amount,
              name: assetInfo.params.name || 'Unknown Item',
              unitName: assetInfo.params.unitName || '',
              total: assetInfo.params.total,
              decimals: assetInfo.params.decimals,
              creator: assetInfo.params.creator,
              manager: assetInfo.params.manager,
              reserve: assetInfo.params.reserve,
              freeze: assetInfo.params.freeze,
              clawback: assetInfo.params.clawback,
              frozen: asset.isFrozen || false,
              url: assetInfo.params.url || '',
              // We can't access note directly, but we can check the url for metadata
              isGameItem: isGameItem,
              owner: owner,
              isOwner: isOwner,
              ownerAddress: ownerAddress,
            }
          } catch (error) {
            return {
              id: asset.assetId,
              assetId: asset.assetId,
              amount: asset.amount,
              name: 'Unknown Item',
              unitName: '',
              error: 'Could not load asset details',
              isGameItem: false,
            }
          }
        }),
      )

      // Filter to only show game items and assets with amount > 0
      const gameItems = detailedAssets.filter((asset) => asset.amount > 0 && asset.isGameItem)

      // We can't easily fetch assets by creator with the standard API
      // So for now, we'll just return what the user already owns

      // Mark owned assets with the ownership information
      return gameItems.map((asset) => {
        // Add a property that indicates this item is in the user's wallet
        return {
          ...asset,
          isInWallet: true,
        }
      })

      return gameItems
    } catch (error) {
      throw new Error(`Could not load user assets: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Check if an item exists and get its ownership info
   */
  async getItemOwnershipInfo(itemId: bigint, sender: string): Promise<string> {
    // Since the smart contract method doesn't actually exist yet in the client,
    // we'll provide a mock implementation that returns ownership information
    try {
      // Try to get the asset info from algod directly
      if (!this.algorand) {
        throw new Error('Algorand client not initialized')
      }

      const assetInfo = await this.algorand.client.algod.getAssetByID(Number(itemId)).do()

      // Check for ownership info in the URL or unit name
      const hasOwnershipInfo = assetInfo.params.url && assetInfo.params.url.includes('OWNER:')

      if (hasOwnershipInfo) {
        return `Item has embedded ownership information. Registered to an Algorand address.`
      } else {
        return `Item appears to be a standard asset without ownership metadata. This may be a v1 item before ownership tracking was added.`
      }
    } catch (error) {
      console.error('Failed to get item ownership info:', error)
      return 'Ownership information unavailable'
    }
  }

  /**
   * Check if an item exists in the blockchain
   */
  async checkItemExists(itemId: bigint, sender: string): Promise<boolean> {
    // Since the smart contract method doesn't exist yet in the client,
    // we'll check directly with algod
    try {
      if (!this.algorand) {
        throw new Error('Algorand client not initialized')
      }

      await this.algorand.client.algod.getAssetByID(Number(itemId)).do()
      return true
    } catch (error) {
      console.error('Failed to check if item exists:', error)
      return false
    }
  }
}

// Export a singleton instance
export const algoRealmHelper = new AlgoRealmHelper()
