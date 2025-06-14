import { AlgorandClient } from '@algorandfoundation/algokit-utils/types/algorand-client'
import { AlgoRealmGameManagerClient } from './AlgoRealmGameManager'
import deploymentInfo from './deployment_info.json'

/**
 * Helper class to interact with the deployed AlgoRealm Game Manager contract
 */
export class AlgoRealmHelper {
  private client: AlgoRealmGameManagerClient | null = null
  private algorand: AlgorandClient | null = null

  /**
   * Initialize the client with the deployed contract
   */
  async initialize(algorand: AlgorandClient, sender?: string): Promise<AlgoRealmGameManagerClient> {
    this.algorand = algorand
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
   * Get deployment information
   */
  getDeploymentInfo() {
    return deploymentInfo
  }

  /**
   * Register a new player (requires opt-in first)
   */
  async registerPlayer(playerName: string, sender: string): Promise<any> {
    const client = this.getClient()

    // First, opt-in to the application
    await client.send.optIn.registerPlayer({
      args: { playerName },
      sender,
    })

    // Then register the player
    return await client.send.registerPlayer({
      args: { playerName },
      sender,
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
  ): Promise<any> {
    const client = this.getClient()

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
    })
  }

  /**
   * Recover a lost item
   */
  async recoverLostItem(originalItemId: bigint, recoveryQuestProof: Uint8Array, newRecipient: string, sender: string): Promise<any> {
    const client = this.getClient()

    return await client.send.recoverLostItem({
      args: {
        originalItemId,
        recoveryQuestProof,
        newRecipient,
      },
      sender,
    })
  }

  /**
   * Issue seasonal event item
   */
  async seasonalEventReissue(eventName: string, participationProof: Uint8Array, recipient: string, sender: string): Promise<any> {
    const client = this.getClient()

    return await client.send.seasonalEventReissue({
      args: {
        eventName,
        participationProof,
        recipient,
      },
      sender,
    })
  }

  /**
   * Craft new items from existing ones
   */
  async craftItems(material1: bigint, material2: bigint, recipeId: number, sender: string): Promise<any> {
    const client = this.getClient()

    return await client.send.craftItems({
      args: {
        material_1: material1,
        material_2: material2,
        recipeId: BigInt(recipeId),
      },
      sender,
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
  async advanceSeason(sender: string): Promise<any> {
    const client = this.getClient()

    return await client.send.advanceSeason({
      args: [],
      sender,
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
}

// Export a singleton instance
export const algoRealmHelper = new AlgoRealmHelper()
