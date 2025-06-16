import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { useWallet } from '@txnlab/use-wallet-react'
import { useEffect, useState } from 'react'
import { algoRealmHelper } from '../contracts/AlgoRealmHelper'
import { getAlgodConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { QRModal } from './QRCode'

interface GameInfo {
  totalPlayers: number
  totalItemsCreated: number
  currentSeason: number
}

interface PlayerStats {
  level: number
  experience: number
  recoveryCount: number
}

interface CreatedItem {
  assetId: string
  itemName: string
  itemType: string
  rarity: string
  recipient: string
  transactionId: string
  timestamp: number
}

interface AlgoRealmGameProps {
  onOpenWalletModal: () => void
}

export default function AlgoRealmGame({ onOpenWalletModal }: AlgoRealmGameProps) {
  const { activeAccount, transactionSigner } = useWallet()
  const [, setAlgorand] = useState<AlgorandClient | null>(null)
  const [gameInfo, setGameInfo] = useState<GameInfo | null>(null)
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null)
  const [isRegistered, setIsRegistered] = useState(false)
  const [playerName, setPlayerName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [createdItems, setCreatedItems] = useState<CreatedItem[]>([])
  const [userAssets, setUserAssets] = useState<
    {
      id: bigint
      assetId: bigint
      amount: bigint
      name: string
      unitName: string
      total?: bigint
      decimals?: number
      creator?: string
      manager?: string | undefined
      reserve?: string | undefined
      freeze?: string | undefined
      clawback?: string | undefined
      url?: string | undefined
      metadataHash?: string | undefined
      defaultFrozen?: boolean
      error?: string
      isGameItem?: boolean
      note?: string | undefined
      isOwner?: boolean
      owner?: string | null
      ownerAddress?: string | null
      isInWallet?: boolean
      isRegisteredToYou?: boolean
      currentHolder?: string
    }[]
  >([])
  const [loadingAssets, setLoadingAssets] = useState(false)

  // Item creation form
  const [itemForm, setItemForm] = useState({
    recipient: '',
    itemName: '',
    itemType: '',
    rarity: 'Common',
    attackPower: 10,
    defensePower: 5,
    specialEffect: '',
  })

  // Recovery form
  const [recoveryForm, setRecoveryForm] = useState({
    originalItemId: '',
    questProof: '',
    newRecipient: '',
  })

  // QR Modal state
  const [qrModal, setQrModal] = useState({ isOpen: false, title: '', value: '' })

  // Item detail modal state
  const [itemDetailModal, setItemDetailModal] = useState({
    isOpen: false,
    selectedItem: null as any,
    ownershipInfo: '',
  })

  // Registration check for recipients
  const [recipientRegistrationStatus, setRecipientRegistrationStatus] = useState<{ [key: string]: boolean }>({})
  const [checkingRecipient, setCheckingRecipient] = useState(false)

  const deploymentInfo = algoRealmHelper.getDeploymentInfo()
  const isGameMaster = activeAccount ? algoRealmHelper.isGameMaster(activeAccount.address) : false

  useEffect(() => {
    const setupAlgorand = async () => {
      const config = getAlgodConfigFromViteEnvironment()
      const client = AlgorandClient.fromConfig({ algodConfig: config })
      setAlgorand(client)

      if (activeAccount) {
        await algoRealmHelper.initialize(client, activeAccount.address, transactionSigner)

        await loadGameInfo()
        await loadPlayerStats()
        await loadUserAssets()
        // Set default recipient to user's address for item creation
        setItemForm((prev) => ({
          ...prev,
          recipient: activeAccount.address,
        }))

        // Also set default recipient for recovery form
        setRecoveryForm((prev) => ({
          ...prev,
          newRecipient: activeAccount.address,
        }))
      }
    }

    setupAlgorand()
  }, [activeAccount])

  const loadGameInfo = async () => {
    try {
      const result = await algoRealmHelper.getGameInfo()
      const [totalPlayers, totalItemsCreated, currentSeason] = result
      setGameInfo({
        totalPlayers: Number(totalPlayers),
        totalItemsCreated: Number(totalItemsCreated),
        currentSeason: Number(currentSeason),
      })
    } catch (err) {
      setError('Failed to load game info. Please try again later.')
    }
  }

  const loadPlayerStats = async () => {
    if (!activeAccount) return

    try {
      const result = await algoRealmHelper.getPlayerStats(activeAccount.address)
      const [level, experience, recoveryCount] = result
      setPlayerStats({
        level: Number(level),
        experience: Number(experience),
        recoveryCount: Number(recoveryCount),
      })
      setIsRegistered(Number(level) > 0) // If level > 0, player is registered
    } catch (err) {
      setIsRegistered(false)
    }
  }

  const loadUserAssets = async () => {
    if (!activeAccount) return

    setLoadingAssets(true)
    try {
      const assets = await algoRealmHelper.getUserAssets(activeAccount.address)
      setUserAssets(assets)
    } catch (err) {
      setUserAssets([])
    } finally {
      setLoadingAssets(false)
    }
  }

  const handleRegisterPlayer = async () => {
    if (!activeAccount || !playerName.trim()) return

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      // Show funding message if needed
      setSuccess('Checking account balance and funding if needed...')

      await algoRealmHelper.registerPlayer(playerName, activeAccount.address)
      setSuccess(`Successfully registered as ${playerName}!`)
      await loadGameInfo()
      await loadPlayerStats()
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      if (error.message.includes('funding')) {
        setError(`Account Funding Required: ${error.message}`)
      } else if (error.message.includes('key does not exist in this wallet')) {
        setError(
          `❌ Wallet Connection Issue: The connected wallet doesn't have access to this account's private key. For LocalNet testing, please disconnect and connect using "LocalNet Wallet" instead. Click the "👤 Wallet" button above to switch wallets.`,
        )
      } else {
        setError(`Registration failed: ${error.message}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCreateItem = async () => {
    if (!activeAccount) return

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      // First check if the recipient is registered before attempting to create the item
      const isRecipientRegistered = await checkAddressRegistered(itemForm.recipient)

      if (!isRecipientRegistered) {
        setError(`❌ Error: The recipient "${itemForm.recipient}" is not registered in AlgoRealm.

        The recipient must register as a player before they can receive items.

        Please select a different recipient or have this address register in the game first.`)
        setLoading(false)
        return
      }

      const result = await algoRealmHelper.createGameItem(
        itemForm.recipient,
        itemForm.itemName,
        itemForm.itemType,
        itemForm.rarity,
        itemForm.attackPower,
        itemForm.defensePower,
        itemForm.specialEffect,
        activeAccount.address,
      )

      const assetId = result.return ? result.return.toString() : 'Unknown'

      // Store the created item for reference
      const newItem: CreatedItem = {
        assetId,
        itemName: itemForm.itemName,
        itemType: itemForm.itemType,
        rarity: itemForm.rarity,
        recipient: itemForm.recipient,
        transactionId: result.txIds[0] || 'Unknown',
        timestamp: Date.now(),
      }

      setCreatedItems((prev) => [newItem, ...prev])
      // Check ownership information
      let ownerInfo = ''
      try {
        const ownershipInfo = await algoRealmHelper.getItemOwnershipInfo(BigInt(assetId), activeAccount.address)
        ownerInfo = `\nOwnership registered to: ${itemForm.recipient}`
      } catch (error) {
        console.error('Could not fetch ownership info', error)
      }

      setSuccess(
        `✅ Item "${itemForm.itemName}" created successfully! Asset ID: ${assetId}${ownerInfo}\n\nThe recipient needs to opt-in to this asset and then claim it.`,
      )
      await loadGameInfo()
      await loadUserAssets() // Refresh to show the new item

      setItemForm({
        recipient: '',
        itemName: '',
        itemType: '',
        rarity: 'Common',
        attackPower: 10,
        defensePower: 5,
        specialEffect: '',
      })
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      const errorMsg = error.message || 'Unknown error'

      // Provide more user-friendly error messages based on common smart contract errors
      if (errorMsg.includes('assert failed')) {
        if (errorMsg.includes('Only game master')) {
          setError(`❌ Error: Only the game master can create items. Your account isn't authorized as the game master.`)
        } else if (errorMsg.includes('Recipient must be registered')) {
          setError(
            `❌ Error: The recipient address must be a registered player in the game. Please ensure "${itemForm.recipient}" is registered in AlgoRealm.`,
          )
        } else {
          setError(`❌ Item creation failed due to a contract assertion: ${errorMsg}

          Common reasons for this error:
          1. The recipient may not be registered in the game
          2. You may not have Game Master privileges
          3. The item parameters may be invalid`)
        }
      } else if (errorMsg.includes('rejected')) {
        setError(`❌ Transaction was rejected. Please check your wallet and try again.`)
      } else {
        setError(`❌ Item creation failed: ${errorMsg}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRecoverItem = async () => {
    if (!activeAccount) return

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const questProofBytes = new TextEncoder().encode(recoveryForm.questProof)
      const result = await algoRealmHelper.recoverLostItem(
        BigInt(recoveryForm.originalItemId),
        questProofBytes,
        recoveryForm.newRecipient,
        activeAccount.address,
      )

      setSuccess(`Item recovered successfully! New Asset ID: ${result.return}`)
      await loadPlayerStats()
      setRecoveryForm({
        originalItemId: '',
        questProof: '',
        newRecipient: '',
      })
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(`Item recovery failed: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleAdvanceSeason = async () => {
    if (!activeAccount) return

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const result = await algoRealmHelper.advanceSeason(activeAccount.address)
      setSuccess(`Season advanced! New season: ${result.return}`)
      await loadGameInfo()
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(`Season advance failed: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  // QR code helper functions
  const showAssetQR = (assetId: number) => {
    setQrModal({ isOpen: true, title: 'Asset ID QR Code', value: `Asset ID: ${assetId}` })
  }

  const showTransactionQR = (txId: string) => {
    setQrModal({ isOpen: true, title: 'Transaction ID QR Code', value: `Transaction ID: ${txId}` })
  }

  const viewItemDetails = async (asset: any) => {
    if (!activeAccount) return

    // Default ownership info message
    let ownershipInfo = 'Loading ownership information...'

    try {
      // Try to get ownership info from the blockchain
      ownershipInfo = await algoRealmHelper.getItemOwnershipInfo(BigInt(asset.id), activeAccount.address)
    } catch (error) {
      console.error('Error fetching ownership info:', error)
      ownershipInfo = 'Could not retrieve ownership information'
    }

    // Open the modal with the item details
    setItemDetailModal({
      isOpen: true,
      selectedItem: asset,
      ownershipInfo,
    })
  }

  /**
   * Check if an address is registered as a player
   */
  const checkAddressRegistered = async (address: string): Promise<boolean> => {
    try {
      return await algoRealmHelper.isPlayerRegistered(address)
    } catch (error) {
      console.error('Error checking if player is registered:', error)
      return false
    }
  }

  // Check if a recipient is registered when the address changes
  const checkRecipientRegistration = async (address: string) => {
    if (!address) return

    setCheckingRecipient(true)
    try {
      const isRegistered = await algoRealmHelper.isPlayerRegistered(address)
      setRecipientRegistrationStatus((prev) => ({ ...prev, [address]: isRegistered }))

      if (!isRegistered) {
        // Show a warning but don't block the UI
        setSuccess('')
        setError(`Note: The address "${address}" is not registered in the game. Items can only be created for registered players.`)
      } else {
        // Clear any previous errors about registration
        if (error && error.includes('not registered')) {
          setError(null)
        }
      }
    } catch (err) {
      // Don't show errors from this check to the user, just log them
      // eslint-disable-next-line no-console
      console.log('Error checking recipient registration', err)
    } finally {
      setCheckingRecipient(false)
    }
  }

  useEffect(() => {
    // Check recipient registration status on recipient address change
    checkRecipientRegistration(itemForm.recipient)
  }, [itemForm.recipient])

  if (!activeAccount) {
    return (
      <div className="hero min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <div className="hero-content text-center">
          <div className="max-w-md p-8 bg-black bg-opacity-40 rounded-xl shadow-lg transform transition duration-500 hover:scale-105">
            {' '}
            {/* Added styling */}
            <h1 className="text-5xl font-extrabold text-white mb-6 animate-pulse">🗡️ AlgoRealm</h1> {/* Enhanced heading */}
            <p className="text-xl text-gray-200 mb-8 leading-relaxed">
              A blockchain gaming system on Algorand featuring **on-demand tokenization** for dynamic item management.
            </p>{' '}
            {/* More descriptive */}
            <p className="text-gray-300 text-lg">Please connect your wallet to bravely enter the realm and claim your destiny!</p>{' '}
            {/* More engaging message */}
            <button className="btn btn-primary btn-lg mt-8 animate-bounce" onClick={onOpenWalletModal}>
              {' '}
              {/* Larger, animated button */}
              Connect Wallet 🚀
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4 font-sans text-gray-100">
      {' '}
      {/* Added font-sans and default text color */}
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center mb-10 pt-4">
          {' '}
          {/* Increased bottom margin and top padding */}
          <div className="flex justify-between items-center mb-6">
            {' '}
            {/* Increased bottom margin */}
            <h1 className="text-5xl font-extrabold text-white drop-shadow-lg">🗡️ AlgoRealm Game Manager</h1>{' '}
            {/* Larger, bolder, with shadow */}
            <button
              className="btn btn-outline btn-lg text-white border-white hover:bg-white hover:text-purple-900 transition-all duration-300"
              onClick={onOpenWalletModal}
            >
              {' '}
              {/* Styled button */}
              👤 My Wallet
            </button>
          </div>
          <div className="bg-gradient-to-r from-gray-800 to-black bg-opacity-70 rounded-xl p-6 text-white shadow-xl">
            {' '}
            {/* Enhanced background and shadow */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-lg font-medium">
              {' '}
              {/* Grid for better layout */}
              <p>
                <strong className="text-blue-300">App ID:</strong> <span className="font-mono">{deploymentInfo.app_id}</span>
              </p>
              <p>
                <strong className="text-blue-300">Network:</strong> <span className="font-mono capitalize">{deploymentInfo.network}</span>{' '}
                {/* Capitalize network */}
              </p>
              <p className="md:col-span-2 lg:col-span-1">
                {' '}
                {/* Adjusted span for responsive layout */}
                <strong className="text-blue-300">Connected As:</strong> <span className="font-mono text-sm">{activeAccount.address}</span>
              </p>
              {isGameMaster && (
                <p className="text-yellow-400 text-xl font-bold col-span-full">
                  {' '}
                  {/* Centered and prominent */}
                  👑 Game Master Privileges Active 👑
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div role="alert" className="alert alert-error mb-6 shadow-lg transform transition duration-300 hover:scale-[1.01]">
            {' '}
            {/* Added role, shadow, and transition */}
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>{' '}
            {/* DaisyUI icon */}
            <span>❌ {error}</span>
          </div>
        )}
        {success && (
          <div role="alert" className="alert alert-success mb-6 shadow-lg transform transition duration-300 hover:scale-[1.01]">
            {' '}
            {/* Added role, shadow, and transition */}
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>{' '}
            {/* DaisyUI icon */}
            <span>✅ {success}</span>
          </div>
        )}

        {/* Game Info */}
        {gameInfo && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {' '}
            {/* Increased gap and bottom margin */}
            <div className="stat bg-gradient-to-br from-indigo-800 to-purple-800 text-white rounded-xl p-6 shadow-lg transform transition duration-300 hover:scale-105 hover:shadow-2xl">
              {' '}
              {/* Enhanced background, padding, shadow, and hover effects */}
              <div className="stat-title text-indigo-200 text-lg">Total Players</div>
              <div className="stat-value text-blue-300 text-4xl font-extrabold">{gameInfo.totalPlayers}</div>
            </div>
            <div className="stat bg-gradient-to-br from-teal-800 to-green-800 text-white rounded-xl p-6 shadow-lg transform transition duration-300 hover:scale-105 hover:shadow-2xl">
              <div className="stat-title text-teal-200 text-lg">Items Created</div>
              <div className="stat-value text-green-300 text-4xl font-extrabold">{gameInfo.totalItemsCreated}</div>
            </div>
            <div className="stat bg-gradient-to-br from-pink-800 to-red-800 text-white rounded-xl p-6 shadow-lg transform transition duration-300 hover:scale-105 hover:shadow-2xl">
              <div className="stat-title text-pink-200 text-lg">Current Season</div>
              <div className="stat-value text-purple-300 text-4xl font-extrabold">{gameInfo.currentSeason}</div>
            </div>
          </div>
        )}

        {/* Player Stats */}
        {playerStats && isRegistered && (
          <div className="bg-gradient-to-r from-gray-800 to-slate-900 rounded-xl p-8 mb-10 text-white shadow-xl border border-gray-700">
            {' '}
            {/* Enhanced background, padding, shadow, and border */}
            <h3 className="text-3xl font-extrabold text-yellow-300 mb-6 flex items-center">
              <span className="mr-3">👤</span> Your Hero Stats
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xl">
              {' '}
              {/* Increased gap and text size */}
              <div className="bg-gray-700 p-4 rounded-lg shadow-md flex items-center justify-center">
                {' '}
                {/* Styled stat boxes */}
                Level: <span className="text-yellow-400 font-bold ml-2">{playerStats.level}</span>
              </div>
              <div className="bg-gray-700 p-4 rounded-lg shadow-md flex items-center justify-center">
                Experience: <span className="text-blue-400 font-bold ml-2">{playerStats.experience}</span>
              </div>
              <div className="bg-gray-700 p-4 rounded-lg shadow-md flex items-center justify-center">
                Recoveries: <span className="text-red-400 font-bold ml-2">{playerStats.recoveryCount}</span>
              </div>
            </div>
          </div>
        )}

        {/* Registration */}
        {!isRegistered && (
          <div className="bg-gradient-to-r from-blue-900 to-purple-900 rounded-xl p-8 mb-10 shadow-xl border border-blue-700">
            {' '}
            {/* Enhanced background, padding, shadow, and border */}
            <h3 className="text-3xl font-extrabold text-white mb-6 text-center">🎮 Embark on Your Adventure! Register Now</h3>{' '}
            {/* Centered, bolder, with shadow */}
            <div className="flex flex-col md:flex-row gap-6 items-center">
              {' '}
              {/* Improved layout for responsiveness */}
              <input
                type="text"
                placeholder="Choose your unique player name..."
                className="input input-lg input-bordered w-full md:flex-1 bg-gray-900 text-white border-blue-500 focus:border-purple-400 transition-all duration-300 placeholder-gray-400"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
              />
              <button
                className="btn btn-primary btn-lg w-full md:w-auto transform transition duration-300 hover:scale-105 hover:shadow-xl"
                onClick={handleRegisterPlayer}
                disabled={loading || !playerName.trim()}
              >
                {loading ? 'Registering Hero...' : 'Register to Play!'}
              </button>
            </div>
          </div>
        )}

        {/* Game Master Panel */}
        {isGameMaster && isRegistered && (
          <div className="bg-gradient-to-r from-yellow-900 to-orange-900 rounded-xl p-8 mb-10 shadow-2xl border border-yellow-700">
            {' '}
            {/* Distinct background for Game Master */}
            <h3 className="text-3xl font-extrabold text-yellow-300 mb-6 text-center">👑 Game Master Control Panel 👑</h3>
            {/* Create Item */}
            <div className="mb-8 p-6 bg-yellow-950 bg-opacity-50 rounded-lg border border-yellow-600 shadow-md">
              {' '}
              {/* Nested section styling */}
              <h4 className="text-2xl font-bold text-white mb-4 flex items-center">
                <span className="mr-2">⚔️</span> Forge New Game Items
                {isGameMaster && (
                  <span className="ml-3 text-xs bg-green-600 px-2 py-1 rounded-full text-white">Game Master Authorized ✓</span>
                )}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {' '}
                {/* Responsive grid */}
                <div className="flex flex-col gap-1">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Recipient Address (default: your wallet)"
                      className={`input input-bordered flex-1 bg-gray-800 text-white border-${
                        itemForm.recipient ? (isRegistered ? 'green-500' : 'red-500') : 'gray-600'
                      } placeholder-gray-400`}
                      value={itemForm.recipient}
                      onChange={(e) => {
                        const newRecipient = e.target.value
                        setItemForm({ ...itemForm, recipient: newRecipient })
                        // Check registration status when typing stops (debounce)
                        if (newRecipient && newRecipient.length >= 58) {
                          checkRecipientRegistration(newRecipient)
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => {
                        if (activeAccount) {
                          setItemForm({ ...itemForm, recipient: activeAccount.address })
                          // We know current account is registered, so set it directly
                          setRecipientRegistrationStatus((prev) => ({
                            ...prev,
                            [activeAccount.address]: isRegistered,
                          }))
                        }
                      }}
                      title="Use my address"
                    >
                      🏠
                    </button>
                  </div>
                  {itemForm.recipient && (
                    <div className="text-xs">
                      {checkingRecipient && <p className="text-blue-400">Checking if address is registered...</p>}
                      {!checkingRecipient && recipientRegistrationStatus[itemForm.recipient] === false && (
                        <p className="text-red-400">
                          ⚠️ Warning: This address is not registered in the game. Items can only be created for registered players.
                        </p>
                      )}
                      {!checkingRecipient && recipientRegistrationStatus[itemForm.recipient] === true && (
                        <p className="text-green-400">✓ This address is registered and can receive items.</p>
                      )}
                    </div>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Item Name (e.g., 'Dragonfire Sword')"
                  className="input input-bordered w-full bg-gray-800 text-white border-gray-600 placeholder-gray-400"
                  value={itemForm.itemName}
                  onChange={(e) => setItemForm({ ...itemForm, itemName: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Item Type (e.g., 'Weapon', 'Armor')"
                  className="input input-bordered w-full bg-gray-800 text-white border-gray-600 placeholder-gray-400"
                  value={itemForm.itemType}
                  onChange={(e) => setItemForm({ ...itemForm, itemType: e.target.value })}
                />
                <select
                  className="select select-bordered w-full bg-gray-800 text-white border-gray-600"
                  value={itemForm.rarity}
                  onChange={(e) => setItemForm({ ...itemForm, rarity: e.target.value })}
                >
                  <option value="Common">Common</option>
                  <option value="Rare">Rare</option>
                  <option value="Epic">Epic</option>
                  <option value="Legendary">Legendary</option>
                </select>
                <input
                  type="number"
                  placeholder="Attack Power (e.g., 10)"
                  className="input input-bordered w-full bg-gray-800 text-white border-gray-600 placeholder-gray-400"
                  value={itemForm.attackPower}
                  onChange={(e) => setItemForm({ ...itemForm, attackPower: parseInt(e.target.value) || 0 })}
                />
                <input
                  type="number"
                  placeholder="Defense Power (e.g., 5)"
                  className="input input-bordered w-full bg-gray-800 text-white border-gray-600 placeholder-gray-400"
                  value={itemForm.defensePower}
                  onChange={(e) => setItemForm({ ...itemForm, defensePower: parseInt(e.target.value) || 0 })}
                />
                <textarea
                  placeholder="Special Effect (e.g., 'Grants +5 speed')"
                  className="textarea textarea-bordered col-span-full bg-gray-800 text-white border-gray-600 placeholder-gray-400"
                  value={itemForm.specialEffect}
                  onChange={(e) => setItemForm({ ...itemForm, specialEffect: e.target.value })}
                  rows={2} // Increased rows for better input
                ></textarea>
              </div>
              <button
                className="btn btn-warning btn-lg w-full transform transition duration-300 hover:scale-105 hover:shadow-xl"
                onClick={handleCreateItem}
                disabled={loading || !itemForm.recipient || !itemForm.itemName}
              >
                {loading ? 'Forging Item...' : 'Create New Item'}
              </button>
            </div>
            {/* Advance Season */}
            <div className="p-6 bg-yellow-950 bg-opacity-50 rounded-lg border border-yellow-600 shadow-md">
              {' '}
              {/* Nested section styling */}
              <h4 className="text-2xl font-bold text-white mb-4 flex items-center">
                <span className="mr-2">🌟</span> Advance The Realm's Season
              </h4>
              <button
                className="btn btn-secondary btn-lg w-full transform transition duration-300 hover:scale-105 hover:shadow-xl"
                onClick={handleAdvanceSeason}
                disabled={loading}
              >
                {loading ? 'Advancing Season...' : 'Advance to Next Season'}
              </button>
            </div>
          </div>
        )}

        {/* Created Items Reference */}
        {createdItems.length > 0 && (
          <div className="bg-gradient-to-r from-green-900 to-teal-900 rounded-xl p-8 mb-10 shadow-xl border border-green-700">
            {' '}
            {/* Enhanced background */}
            <h3 className="text-3xl font-extrabold text-green-300 mb-6 flex items-center">
              <span className="mr-3">📋</span> Recently Forged Items
            </h3>
            <p className="text-gray-200 mb-6">
              Track the items you've created and their Algorand Asset IDs for potential recovery or verification:
            </p>
            <div className="overflow-x-auto rounded-lg shadow-md border border-gray-700">
              {' '}
              {/* Styled table container */}
              <table className="table table-zebra w-full text-white">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="text-white text-base">Asset ID</th>
                    <th className="text-white text-base">Item Name</th>
                    <th className="text-white text-base">Type</th>
                    <th className="text-white text-base">Rarity</th>
                    <th className="text-white text-base">Recipient</th>
                    <th className="text-white text-base">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {createdItems.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-700 transition-colors duration-200">
                      {' '}
                      {/* Hover effect */}
                      <td className="font-mono text-sm text-gray-300">{item.assetId}</td>
                      <td className="text-blue-300 font-medium">{item.itemName}</td>
                      <td className="text-purple-300">{item.itemType}</td>
                      <td>
                        <span
                          className={`badge text-sm font-semibold p-2 ${
                            item.rarity === 'Legendary'
                              ? 'badge-warning text-yellow-900 bg-yellow-300'
                              : item.rarity === 'Epic'
                                ? 'badge-secondary text-pink-900 bg-pink-300'
                                : item.rarity === 'Rare'
                                  ? 'badge-info text-blue-900 bg-blue-300'
                                  : 'badge-outline text-gray-300 border-gray-500'
                          }`}
                        >
                          {item.rarity}
                        </span>
                      </td>
                      <td className="font-mono text-xs text-gray-400">
                        {item.recipient.slice(0, 8)}...{item.recipient.slice(-8)}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          {' '}
                          {/* Added flex-wrap for smaller screens */}
                          <button
                            className="btn btn-xs btn-primary btn-outline"
                            onClick={() => {
                              navigator.clipboard.writeText(item.assetId)
                              setSuccess(`Copied Asset ID: ${item.assetId}`)
                            }}
                          >
                            📋 Copy ID
                          </button>
                          <button
                            className="btn btn-xs btn-accent btn-outline"
                            onClick={() => {
                              setRecoveryForm({
                                ...recoveryForm,
                                originalItemId: item.assetId,
                                newRecipient: item.recipient,
                              })
                            }}
                          >
                            🔗 Use for Recovery
                          </button>
                          <button className="btn btn-xs btn-info btn-outline" onClick={() => showAssetQR(Number(item.assetId))}>
                            📱 QR Asset ID
                          </button>
                          <button className="btn btn-xs btn-success btn-outline" onClick={() => showTransactionQR(item.transactionId)}>
                            🌐 QR Txn ID
                          </button>
                          <a
                            className="btn btn-xs btn-success btn-outline"
                            href={`https://lora.algokit.io/localnet/transaction/${item.transactionId}`}
                            target="_blank"
                          >
                            See transaction
                          </a>
                          <button className="btn btn-xs btn-secondary btn-outline" onClick={() => viewItemDetails(item)}>
                            📖 View Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* My Items */}
        {isRegistered && (
          <div className="bg-gradient-to-r from-indigo-900 to-blue-900 rounded-xl p-8 mb-10 text-white shadow-xl border border-blue-700">
            {' '}
            {/* Enhanced background */}
            <div className="flex flex-col space-y-4 mb-6">
              <div className="flex justify-between items-center">
                <h3 className="text-3xl font-extrabold flex items-center">
                  <span className="mr-3">🎒</span> My Personal Inventory
                </h3>
                <button
                  className="btn btn-outline btn-lg text-white border-white hover:bg-white hover:text-indigo-900 transition-all duration-300"
                  onClick={loadUserAssets}
                  disabled={loadingAssets}
                >
                  {loadingAssets ? 'Loading...' : '🔄 Refresh My Items'}
                </button>
              </div>

              {/* New ownership filter controls */}
              <div className="flex items-center space-x-2 bg-gray-800 p-3 rounded-lg">
                <span className="text-gray-300 font-medium">Filter by: </span>
                <button
                  className="px-3 py-1 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700"
                  onClick={() =>
                    setUserAssets((prevAssets) =>
                      [...prevAssets].sort((a, b) => {
                        if (a.isOwner && !b.isOwner) return -1
                        if (!a.isOwner && b.isOwner) return 1
                        return 0
                      }),
                    )
                  }
                >
                  Show Owned First
                </button>
                <button
                  className="px-3 py-1 rounded-md bg-purple-600 text-white text-sm hover:bg-purple-700"
                  onClick={() => setUserAssets((prevAssets) => prevAssets.filter((asset) => asset.isOwner))}
                >
                  Only My Items
                </button>
                <button className="px-3 py-1 rounded-md bg-gray-600 text-white text-sm hover:bg-gray-700" onClick={loadUserAssets}>
                  Reset
                </button>
              </div>
            </div>
            {userAssets.length === 0 ? (
              <div className="text-center py-10 text-gray-400 bg-gray-900 bg-opacity-50 rounded-lg border border-gray-700">
                {' '}
                {/* Styled empty state */}
                <div className="text-6xl mb-4 animate-bounce">📦</div>
                <p className="text-xl font-semibold mb-2">Your inventory is currently empty!</p>
                <p className="text-lg mt-2 max-w-lg mx-auto">
                  Items will magically appear here after you create them (as Game Master), claim them from quests, or receive them from
                  other players.
                </p>
                <p className="text-md mt-4 text-gray-500">Don't forget to **opt-in** to new assets if they aren't appearing!</p>
                {/* Check if we have any items that are registered to the user but not in their wallet */}
                {userAssets.some((asset) => asset.isOwner && !asset.isInWallet) && (
                  <div className="mt-8 bg-indigo-900 bg-opacity-30 p-4 rounded-lg border border-indigo-700">
                    <h4 className="text-indigo-400 font-bold text-lg">Items Registered To You</h4>
                    <p className="text-sm text-indigo-200 mb-3">
                      These items are registered with you as the owner but are not in your wallet yet.
                    </p>
                    <button className="btn btn-sm btn-outline btn-primary" onClick={loadUserAssets}>
                      Refresh Registered Items
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {' '}
                {/* Increased gap */}
                {userAssets.map((asset) => (
                  <div
                    key={asset.id}
                    onClick={() => viewItemDetails(asset)}
                    className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg transform transition duration-300 hover:scale-[1.02] hover:shadow-2xl cursor-pointer"
                  >
                    {' '}
                    {/* Enhanced card styling */}
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="text-xl font-bold text-yellow-400">{asset.name || `Mysterious Item #${asset.id}`}</h4>
                      <span className="text-sm bg-blue-700 px-3 py-1 rounded-full font-semibold">ASA ID: {asset.id.toString()}</span>{' '}
                      {/* More prominent ASA ID */}
                    </div>
                    <div className="space-y-2 text-base text-gray-200">
                      {/* Ownership badge - new! */}
                      {asset.isOwner && (
                        <div className="bg-gradient-to-r from-purple-700 to-indigo-800 text-white px-3 py-1 rounded-md inline-block mb-2">
                          <span className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                              />
                            </svg>
                            Registered Owner
                          </span>
                        </div>
                      )}
                      {asset.owner && !asset.isOwner && (
                        <div className="bg-gray-700 text-gray-200 px-3 py-1 rounded-md inline-block mb-2">
                          <span className="text-xs">Owned by: {asset.owner.substring(0, 8)}...</span>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-400">Unit Name:</span>
                        <span className="ml-2 text-white font-medium">{asset.unitName || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Quantity:</span>
                        <span className="ml-2 text-green-400 font-bold">{asset.amount.toString()}</span>
                        {/* Show item location if not in wallet */}
                        {asset.isRegisteredToYou && !asset.isInWallet && (
                          <span className="ml-2 text-yellow-500 text-xs">(Held by: {asset.currentHolder})</span>
                        )}
                      </div>
                      {asset.creator && (
                        <div>
                          <span className="text-gray-400">Creator:</span>
                          <span className="ml-2 text-blue-400 font-mono text-xs cursor-pointer hover:underline" title={asset.creator}>
                            {asset.creator.slice(0, 8)}...{asset.creator.slice(-8)}
                          </span>
                        </div>
                      )}
                      {asset.url && (
                        <div>
                          <span className="text-gray-400">Details:</span>
                          <a
                            href={asset.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-blue-400 hover:underline transition-colors duration-200"
                          >
                            View on Explorer
                          </a>
                        </div>
                      )}
                    </div>
                    <div className="mt-5 pt-4 border-t border-gray-700">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="btn btn-sm btn-outline btn-primary"
                          onClick={() => {
                            navigator.clipboard.writeText(asset.id.toString())
                            setSuccess(`Asset ID ${asset.id} copied to clipboard!`)
                            setTimeout(() => setSuccess(''), 3000)
                          }}
                        >
                          📋 Copy ID
                        </button>
                        {asset.url && (
                          <button className="btn btn-sm btn-outline btn-info" onClick={() => window.open(asset.url, '_blank')}>
                            🔗 View Details
                          </button>
                        )}
                        <button className="btn btn-sm btn-outline btn-success" onClick={() => showAssetQR(Number(asset.id))}>
                          📱 QR Code
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-8 p-6 bg-gray-900 rounded-xl border border-gray-700 shadow-inner">
              {' '}
              {/* Styled info box */}
              <h4 className="text-xl font-bold mb-3 text-blue-400 flex items-center">
                <span className="mr-2">💡</span> Ways to Acquire Items
              </h4>
              <ul className="text-base text-gray-300 space-y-2 list-disc list-inside">
                {' '}
                {/* Styled list */}
                <li>Ask the **Game Master** to mint and send items directly to your wallet.</li>
                <li>Actively participate in exciting **seasonal events** to earn exclusive rewards.</li>
                <li>Successfully complete **recovery quests** to reclaim lost or destroyed items.</li>
                <li>Gather materials and **craft** unique items (if crafting mechanics are implemented).</li>
                <li>
                  <strong className="text-yellow-400">Important:</strong> Always remember to **opt-in** to new Algorand Standard Assets
                  (ASAs) in your wallet before you can receive them!
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* Player Panel - Item Recovery */}
        {isRegistered && (
          <div className="bg-gradient-to-r from-red-900 to-orange-900 rounded-xl p-8 shadow-xl border border-red-700">
            {' '}
            {/* Distinct background for recovery */}
            <h3 className="text-3xl font-extrabold text-white mb-6 flex items-center">
              <span className="mr-3">🔄</span> The Lost & Found: Item Recovery
            </h3>
            <p className="text-gray-200 mb-6 leading-relaxed">
              Have you lost a precious item in the treacherous lands of AlgoRealm? Provide the necessary proof of your valor and recover it!
              This showcases our **on-demand tokenization** feature.
            </p>
            <div className="grid grid-cols-1 gap-6 mb-6">
              {' '}
              {/* Increased gap */}
              {/* Item Asset ID Field */}
              <div>
                <label className="label">
                  <span className="label-text text-white font-semibold text-lg">Original Item Asset ID</span>
                  <span className="label-text-alt text-gray-400 text-sm">The unique ID of the lost item on Algorand</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., 1234567890 (Algorand Standard Asset ID)"
                  className="input input-bordered w-full input-lg bg-gray-800 text-white border-red-500 focus:border-red-400 placeholder-gray-400"
                  value={recoveryForm.originalItemId}
                  onChange={(e) => setRecoveryForm({ ...recoveryForm, originalItemId: e.target.value })}
                />
                <div className="label">
                  <span className="label-text-alt text-gray-500 text-sm">
                    💡 This is the **Algorand Asset ID** of the NFT or ASA you lost. You can find this in your wallet's transaction history
                    or game logs.
                  </span>
                </div>
              </div>
              {/* Quest Proof Field */}
              <div>
                <label className="label">
                  <span className="label-text text-white font-semibold text-lg">Quest Completion Proof</span>
                  <span className="label-text-alt text-gray-400 text-sm">The cryptographic proof from your heroic recovery quest</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., quest_hash_abc123xyz or a specific transaction ID"
                  className="input input-bordered w-full input-lg bg-gray-800 text-white border-red-500 focus:border-red-400 placeholder-gray-400"
                  value={recoveryForm.questProof}
                  onChange={(e) => setRecoveryForm({ ...recoveryForm, questProof: e.target.value })}
                />
                <div className="label">
                  <span className="label-text-alt text-gray-500 text-sm">
                    💡 Successfully complete the recovery quest within the AlgoRealm game to obtain this unique proof hash or transaction
                    ID.
                  </span>
                </div>
              </div>
              {/* New Recipient Field */}
              <div>
                <label className="label">
                  <span className="label-text text-white font-semibold text-lg">New Recipient Address</span>
                  <span className="label-text-alt text-gray-400 text-sm">Where the recovered item will be sent</span>
                </label>
                <div className="flex flex-col md:flex-row gap-3">
                  {' '}
                  {/* Improved layout */}
                  <input
                    type="text"
                    placeholder="e.g., ABC123...XYZ789 (Your Algorand wallet address)"
                    className="input input-bordered flex-1 input-lg bg-gray-800 text-white border-red-500 focus:border-red-400 placeholder-gray-400"
                    value={recoveryForm.newRecipient}
                    onChange={(e) => setRecoveryForm({ ...recoveryForm, newRecipient: e.target.value })}
                  />
                  <button
                    className="btn btn-outline btn-lg text-white border-white hover:bg-white hover:text-red-900 transition-all duration-300 w-full md:w-auto"
                    onClick={() => {
                      if (activeAccount) {
                        setRecoveryForm({ ...recoveryForm, newRecipient: activeAccount.address })
                      }
                    }}
                  >
                    Use My Wallet Address
                  </button>
                </div>
                <div className="label">
                  <span className="label-text-alt text-gray-500 text-sm">
                    💡 Typically your own connected wallet address, but you can specify another player's address if you're recovering for
                    them.
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-8">
              <button
                className="btn btn-accent btn-lg w-full transform transition duration-300 hover:scale-105 hover:shadow-xl"
                onClick={handleRecoverItem}
                disabled={loading || !recoveryForm.originalItemId || !recoveryForm.questProof || !recoveryForm.newRecipient}
              >
                {loading ? 'Initiating Recovery...' : 'Recover My Lost Item'}
              </button>

              {/* Help Section */}
              <div className="mt-6 p-6 bg-blue-950 bg-opacity-70 rounded-xl shadow-inner border border-blue-800">
                {' '}
                {/* Enhanced styling */}
                <h4 className="text-white font-bold text-xl mb-3 flex items-center">
                  <span className="mr-2">❓</span> Guidance for Item Recovery:
                </h4>
                <ul className="text-gray-300 text-base space-y-2 list-disc list-inside">
                  <li>
                    <strong>Original Item Asset ID:</strong> This is the unique identifier for your lost NFT or ASA. Look it up in your
                    Algorand wallet's asset list or transaction history, or check your game's item logs.
                  </li>
                  <li>
                    <strong>Quest Completion Proof:</strong> To get this, you must successfully complete a designated "Item Recovery Quest"
                    within the AlgoRealm game. Upon completion, the game will provide you with a specific hash or transaction ID as proof.
                  </li>
                  <li>
                    <strong>New Recipient Address:</strong> This is the Algorand address where the newly re-minted item will be sent. In
                    most cases, this will be your own connected wallet address, which you can easily fill using the "Use My Wallet Address"
                    button.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* QR Code Modal (Assuming QRModal component is styled separately) */}
        {qrModal.isOpen && (
          <QRModal
            isOpen={qrModal.isOpen}
            title={qrModal.title}
            value={qrModal.value}
            onClose={() => setQrModal({ isOpen: false, title: '', value: '' })}
          />
        )}

        {/* Item Detail Modal (Newly Added) */}
        {itemDetailModal.isOpen && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div
              className="bg-black bg-opacity-80 absolute inset-0"
              onClick={() => setItemDetailModal({ isOpen: false, selectedItem: null, ownershipInfo: '' })}
            ></div>
            <div className="bg-gray-900 rounded-lg shadow-lg max-w-lg w-full z-10 p-6">
              <h3 className="text-2xl font-extrabold text-white mb-4 flex items-center">
                <span className="mr-3">📖</span> Item Details
              </h3>
              <div className="text-gray-300 text-sm mb-4">
                <p>
                  <strong>Asset ID:</strong> <span className="font-mono">{itemDetailModal.selectedItem.assetId}</span>
                </p>
                <p>
                  <strong>Item Name:</strong> {itemDetailModal.selectedItem.itemName}
                </p>
                <p>
                  <strong>Type:</strong> {itemDetailModal.selectedItem.itemType}
                </p>
                <p>
                  <strong>Rarity:</strong> {itemDetailModal.selectedItem.rarity}
                </p>
                <p>
                  <strong>Recipient:</strong> {itemDetailModal.selectedItem.recipient}
                </p>
                <p>
                  <strong>Transaction ID:</strong> {itemDetailModal.selectedItem.transactionId}
                </p>
                <p>
                  <strong>Timestamp:</strong> {new Date(itemDetailModal.selectedItem.timestamp).toLocaleString()}
                </p>
              </div>
              <div className="text-gray-400 text-xs mb-4">{itemDetailModal.ownershipInfo}</div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    navigator.clipboard.writeText(itemDetailModal.selectedItem.assetId)
                    setSuccess(`Copied Asset ID: ${itemDetailModal.selectedItem.assetId}`)
                  }}
                >
                  📋 Copy Asset ID
                </button>
                <button className="btn btn-success btn-sm" onClick={() => showTransactionQR(itemDetailModal.selectedItem.transactionId)}>
                  🌐 QR Txn ID
                </button>
                <button className="btn btn-info btn-sm" onClick={() => showAssetQR(Number(itemDetailModal.selectedItem.assetId))}>
                  📱 QR Asset ID
                </button>
                <button
                  className="btn btn-accent btn-sm"
                  onClick={() => setItemDetailModal({ isOpen: false, selectedItem: null, ownershipInfo: '' })}
                >
                  ✖️ Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Item Detail Modal */}
      {itemDetailModal.isOpen && itemDetailModal.selectedItem && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-80">
          <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl mx-4 border border-indigo-800">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-2xl font-bold text-white">
                {itemDetailModal.selectedItem.name || `Item #${itemDetailModal.selectedItem.id}`}
              </h3>
              <button
                className="text-gray-400 hover:text-white"
                onClick={() => setItemDetailModal({ isOpen: false, selectedItem: null, ownershipInfo: '' })}
              >
                ✖️
              </button>
            </div>

            <div className="bg-gray-900 p-4 rounded-md mb-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-400 text-sm">Asset ID:</p>
                  <p className="text-white font-mono">{itemDetailModal.selectedItem.id.toString()}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Unit Name:</p>
                  <p className="text-white">{itemDetailModal.selectedItem.unitName || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Amount:</p>
                  <p className="text-green-400">{itemDetailModal.selectedItem.amount?.toString() || '0'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Creator:</p>
                  <p className="text-white font-mono text-xs truncate">{itemDetailModal.selectedItem.creator || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Ownership Information Section */}
            <div className="bg-indigo-900 bg-opacity-30 rounded-md p-4 mb-4">
              <h4 className="text-lg text-indigo-300 font-bold mb-2">Ownership Information</h4>
              {itemDetailModal.selectedItem.isOwner ? (
                <div className="bg-green-900 bg-opacity-50 p-2 rounded text-green-300 mb-2">
                  ✓ You are the registered owner of this item
                </div>
              ) : itemDetailModal.selectedItem.owner ? (
                <div className="bg-yellow-900 bg-opacity-50 p-2 rounded text-yellow-300 mb-2">
                  This item is registered to another address: {itemDetailModal.selectedItem.owner.substring(0, 10)}...
                </div>
              ) : (
                <div className="bg-gray-700 bg-opacity-50 p-2 rounded text-gray-300 mb-2">No ownership information available</div>
              )}
              <div className="text-xs text-gray-300 mt-2">{itemDetailModal.ownershipInfo}</div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  navigator.clipboard.writeText(itemDetailModal.selectedItem.id.toString())
                  setSuccess(`Copied Asset ID: ${itemDetailModal.selectedItem.id}`)
                }}
              >
                📋 Copy ID
              </button>
              <button
                className="btn btn-accent btn-sm"
                onClick={() => setItemDetailModal({ isOpen: false, selectedItem: null, ownershipInfo: '' })}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
