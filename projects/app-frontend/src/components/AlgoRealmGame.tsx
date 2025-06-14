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
  const [algorand, setAlgorand] = useState<AlgorandClient | null>(null)
  const [gameInfo, setGameInfo] = useState<GameInfo | null>(null)
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null)
  const [isRegistered, setIsRegistered] = useState(false)
  const [playerName, setPlayerName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [createdItems, setCreatedItems] = useState<CreatedItem[]>([])
  const [userAssets, setUserAssets] = useState<any[]>([])
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
      console.log('Could not load game info:', err)
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
      console.log('Could not load player stats:', err)
      setIsRegistered(false)
    }
  }

  const loadUserAssets = async () => {
    if (!activeAccount) return

    setLoadingAssets(true)
    try {
      console.log('Loading user assets for:', activeAccount.address)
      const assets = await algoRealmHelper.getUserAssets(activeAccount.address)
      console.log('User assets loaded:', assets)
      setUserAssets(assets)
    } catch (err) {
      console.error('Could not load user assets:', err)
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
    } catch (err: any) {
      if (err.message.includes('funding')) {
        setError(`Account Funding Required: ${err.message}`)
      } else if (err.message.includes('key does not exist in this wallet')) {
        setError(
          `❌ Wallet Connection Issue: The connected wallet doesn't have access to this account's private key. For LocalNet testing, please disconnect and connect using "LocalNet Wallet" instead. Click the "👤 Wallet" button above to switch wallets.`,
        )
      } else {
        setError(`Registration failed: ${err.message}`)
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
        transactionId: result.txId || 'Unknown',
        timestamp: Date.now(),
      }

      setCreatedItems((prev) => [newItem, ...prev])
      setSuccess(`✅ Item "${itemForm.itemName}" created successfully! Asset ID: ${assetId}`)
      await loadGameInfo()

      setItemForm({
        recipient: '',
        itemName: '',
        itemType: '',
        rarity: 'Common',
        attackPower: 10,
        defensePower: 5,
        specialEffect: '',
      })
    } catch (err: any) {
      setError(`Item creation failed: ${err.message}`)
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
    } catch (err: any) {
      setError(`Item recovery failed: ${err.message}`)
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
    } catch (err: any) {
      setError(`Season advance failed: ${err.message}`)
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

  if (!activeAccount) {
    return (
      <div className="hero min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <div className="hero-content text-center">
          <div className="max-w-md">
            <h1 className="text-5xl font-bold text-white mb-8">🗡️ AlgoRealm</h1>
            <p className="text-xl text-gray-300 mb-8">A blockchain gaming system on Algorand featuring on-demand tokenization</p>
            <p className="text-gray-400">Please connect your wallet to enter the realm</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-4xl font-bold text-white">🗡️ AlgoRealm Game Manager</h1>
            <button className="btn btn-outline btn-sm" onClick={onOpenWalletModal}>
              👤 Wallet
            </button>
          </div>
          <div className="bg-black bg-opacity-30 rounded-lg p-4 text-white">
            <p>
              <strong>App ID:</strong> {deploymentInfo.app_id}
            </p>
            <p>
              <strong>Network:</strong> {deploymentInfo.network}
            </p>
            <p>
              <strong>Connected:</strong> {activeAccount.address}
            </p>
            {isGameMaster && (
              <p className="text-yellow-400">
                <strong>👑 Game Master</strong>
              </p>
            )}
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="alert alert-error mb-4">
            <span>❌ {error}</span>
          </div>
        )}
        {success && (
          <div className="alert alert-success mb-4">
            <span>✅ {success}</span>
          </div>
        )}

        {/* Game Info */}
        {gameInfo && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="stat bg-black bg-opacity-30 text-white rounded-lg">
              <div className="stat-title text-gray-300">Total Players</div>
              <div className="stat-value text-blue-400">{gameInfo.totalPlayers}</div>
            </div>
            <div className="stat bg-black bg-opacity-30 text-white rounded-lg">
              <div className="stat-title text-gray-300">Items Created</div>
              <div className="stat-value text-green-400">{gameInfo.totalItemsCreated}</div>
            </div>
            <div className="stat bg-black bg-opacity-30 text-white rounded-lg">
              <div className="stat-title text-gray-300">Current Season</div>
              <div className="stat-value text-purple-400">{gameInfo.currentSeason}</div>
            </div>
          </div>
        )}

        {/* Player Stats */}
        {playerStats && isRegistered && (
          <div className="bg-black bg-opacity-30 rounded-lg p-6 mb-8 text-white">
            <h3 className="text-2xl font-bold mb-4">👤 Player Stats</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                Level: <span className="text-yellow-400 font-bold">{playerStats.level}</span>
              </div>
              <div>
                Experience: <span className="text-blue-400 font-bold">{playerStats.experience}</span>
              </div>
              <div>
                Recoveries: <span className="text-red-400 font-bold">{playerStats.recoveryCount}</span>
              </div>
            </div>
          </div>
        )}

        {/* Registration */}
        {!isRegistered && (
          <div className="bg-black bg-opacity-30 rounded-lg p-6 mb-8">
            <h3 className="text-2xl font-bold text-white mb-4">🎮 Register to Play</h3>
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="Enter your player name"
                className="input input-bordered flex-1"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
              />
              <button className="btn btn-primary" onClick={handleRegisterPlayer} disabled={loading || !playerName.trim()}>
                {loading ? 'Registering...' : 'Register'}
              </button>
            </div>
          </div>
        )}

        {/* Game Master Panel */}
        {isGameMaster && isRegistered && (
          <div className="bg-yellow-900 bg-opacity-30 rounded-lg p-6 mb-8">
            <h3 className="text-2xl font-bold text-yellow-400 mb-4">👑 Game Master Panel</h3>

            {/* Create Item */}
            <div className="mb-6">
              <h4 className="text-xl text-white mb-3">⚔️ Create Game Item</h4>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Recipient Address"
                  className="input input-bordered"
                  value={itemForm.recipient}
                  onChange={(e) => setItemForm({ ...itemForm, recipient: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Item Name"
                  className="input input-bordered"
                  value={itemForm.itemName}
                  onChange={(e) => setItemForm({ ...itemForm, itemName: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Item Type"
                  className="input input-bordered"
                  value={itemForm.itemType}
                  onChange={(e) => setItemForm({ ...itemForm, itemType: e.target.value })}
                />
                <select
                  className="select select-bordered"
                  value={itemForm.rarity}
                  onChange={(e) => setItemForm({ ...itemForm, rarity: e.target.value })}
                >
                  <option>Common</option>
                  <option>Rare</option>
                  <option>Epic</option>
                  <option>Legendary</option>
                </select>
                <input
                  type="number"
                  placeholder="Attack Power"
                  className="input input-bordered"
                  value={itemForm.attackPower}
                  onChange={(e) => setItemForm({ ...itemForm, attackPower: parseInt(e.target.value) || 0 })}
                />
                <input
                  type="number"
                  placeholder="Defense Power"
                  className="input input-bordered"
                  value={itemForm.defensePower}
                  onChange={(e) => setItemForm({ ...itemForm, defensePower: parseInt(e.target.value) || 0 })}
                />
                <input
                  type="text"
                  placeholder="Special Effect"
                  className="input input-bordered col-span-2"
                  value={itemForm.specialEffect}
                  onChange={(e) => setItemForm({ ...itemForm, specialEffect: e.target.value })}
                />
              </div>
              <button
                className="btn btn-warning mt-4"
                onClick={handleCreateItem}
                disabled={loading || !itemForm.recipient || !itemForm.itemName}
              >
                {loading ? 'Creating...' : 'Create Item'}
              </button>
            </div>

            {/* Advance Season */}
            <div>
              <h4 className="text-xl text-white mb-3">🌟 Season Management</h4>
              <button className="btn btn-secondary" onClick={handleAdvanceSeason} disabled={loading}>
                {loading ? 'Advancing...' : 'Advance Season'}
              </button>
            </div>
          </div>
        )}

        {/* Created Items Reference */}
        {createdItems.length > 0 && (
          <div className="bg-black bg-opacity-30 rounded-lg p-6">
            <h3 className="text-2xl font-bold text-green-400 mb-4">📋 Created Items Reference</h3>
            <p className="text-gray-300 mb-4">Here are the items you've created with their Asset IDs for recovery:</p>

            <div className="overflow-x-auto">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th className="text-white">Asset ID</th>
                    <th className="text-white">Item Name</th>
                    <th className="text-white">Type</th>
                    <th className="text-white">Rarity</th>
                    <th className="text-white">Recipient</th>
                    <th className="text-white">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {createdItems.map((item, index) => (
                    <tr key={index}>
                      <td className="font-mono text-sm">{item.assetId}</td>
                      <td>{item.itemName}</td>
                      <td>{item.itemType}</td>
                      <td>
                        <span
                          className={`badge ${
                            item.rarity === 'Legendary'
                              ? 'badge-warning'
                              : item.rarity === 'Epic'
                                ? 'badge-secondary'
                                : item.rarity === 'Rare'
                                  ? 'badge-info'
                                  : 'badge-outline'
                          }`}
                        >
                          {item.rarity}
                        </span>
                      </td>
                      <td className="font-mono text-xs">
                        {item.recipient.slice(0, 8)}...{item.recipient.slice(-8)}
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <button
                            className="btn btn-xs btn-primary"
                            onClick={() => {
                              navigator.clipboard.writeText(item.assetId)
                              setSuccess(`Copied Asset ID: ${item.assetId}`)
                            }}
                          >
                            Copy ID
                          </button>
                          <button
                            className="btn btn-xs btn-accent"
                            onClick={() => {
                              setRecoveryForm({
                                ...recoveryForm,
                                originalItemId: item.assetId,
                                newRecipient: item.recipient,
                              })
                            }}
                          >
                            Use for Recovery
                          </button>
                          <button className="btn btn-xs btn-info" onClick={() => showAssetQR(Number(item.assetId))}>
                            QR Asset ID
                          </button>
                          <button className="btn btn-xs btn-success" onClick={() => showTransactionQR(item.transactionId)}>
                            QR Txn ID
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
          <div className="bg-black bg-opacity-30 rounded-lg p-6 mb-8 text-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold">🎒 My Items</h3>
              <button className="btn btn-outline btn-sm" onClick={loadUserAssets} disabled={loading}>
                {loading ? 'Loading...' : '🔄 Refresh'}
              </button>
            </div>

            {userAssets.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <div className="text-4xl mb-2">📦</div>
                <p>No items found in your inventory</p>
                <p className="text-sm mt-2">Items will appear here after you create or claim them</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {userAssets.map((asset) => (
                  <div key={asset.id} className="bg-gray-800 rounded-lg p-4 border border-gray-600">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-lg font-bold text-yellow-400">{asset.name || `Item #${asset.id}`}</h4>
                      <span className="text-xs bg-blue-600 px-2 py-1 rounded">ASA {asset.id}</span>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-gray-400">Unit:</span>
                        <span className="ml-2 text-white">{asset.unitName}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Amount:</span>
                        <span className="ml-2 text-green-400">{asset.amount}</span>
                      </div>
                      {asset.creator && (
                        <div>
                          <span className="text-gray-400">Creator:</span>
                          <span className="ml-2 text-blue-400 font-mono text-xs">
                            {asset.creator.slice(0, 8)}...{asset.creator.slice(-8)}
                          </span>
                        </div>
                      )}
                      {asset.url && (
                        <div>
                          <span className="text-gray-400">URL:</span>
                          <a href={asset.url} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-400 hover:underline">
                            View Details
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-600">
                      <div className="flex gap-2">
                        <button
                          className="btn btn-xs btn-outline"
                          onClick={() => {
                            navigator.clipboard.writeText(asset.id.toString())
                            setSuccess(`Asset ID ${asset.id} copied to clipboard!`)
                            setTimeout(() => setSuccess(''), 3000)
                          }}
                        >
                          📋 Copy ID
                        </button>
                        {asset.url && (
                          <button className="btn btn-xs btn-outline" onClick={() => window.open(asset.url, '_blank')}>
                            🔗 View
                          </button>
                        )}
                        <button className="btn btn-xs btn-info" onClick={() => showAssetQR(asset.id)}>
                          📱 QR Asset ID
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 p-4 bg-gray-800 rounded-lg border border-gray-600">
              <h4 className="text-lg font-bold mb-2 text-blue-400">💡 How to Get Items</h4>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• Ask the Game Master to create items for you</li>
                <li>• Participate in seasonal events</li>
                <li>• Recover lost items using quest proofs</li>
                <li>• Craft items using materials</li>
                <li>• Remember to opt-in to asset before claiming items!</li>
              </ul>
            </div>
          </div>
        )}

        {/* Player Panel */}
        {isRegistered && (
          <div className="bg-black bg-opacity-30 rounded-lg p-6">
            <h3 className="text-2xl font-bold text-white mb-4">🔄 Item Recovery</h3>
            <p className="text-gray-300 mb-4">Lost an item? Complete a quest and recover it here! (On-demand tokenization feature)</p>

            <div className="grid grid-cols-1 gap-4">
              {/* Item Asset ID Field */}
              <div>
                <label className="label">
                  <span className="label-text text-white font-semibold">Original Item Asset ID</span>
                  <span className="label-text-alt text-gray-400">Found in your wallet or game inventory</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., 1234567890 (Algorand Asset ID of the lost item)"
                  className="input input-bordered w-full"
                  value={recoveryForm.originalItemId}
                  onChange={(e) => setRecoveryForm({ ...recoveryForm, originalItemId: e.target.value })}
                />
                <div className="label">
                  <span className="label-text-alt text-gray-400">
                    💡 This is the Algorand Asset ID of the NFT item you lost. Check your wallet history or game logs.
                  </span>
                </div>
              </div>

              {/* Quest Proof Field */}
              <div>
                <label className="label">
                  <span className="label-text text-white font-semibold">Quest Completion Proof</span>
                  <span className="label-text-alt text-gray-400">Hash/proof from completing recovery quest</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., quest_hash_abc123 or transaction_id from quest completion"
                  className="input input-bordered w-full"
                  value={recoveryForm.questProof}
                  onChange={(e) => setRecoveryForm({ ...recoveryForm, questProof: e.target.value })}
                />
                <div className="label">
                  <span className="label-text-alt text-gray-400">
                    💡 Complete the recovery quest in-game to get this proof hash or transaction ID.
                  </span>
                </div>
              </div>

              {/* New Recipient Field */}
              <div>
                <label className="label">
                  <span className="label-text text-white font-semibold">New Recipient Address</span>
                  <span className="label-text-alt text-gray-400">Where to send the recovered item</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g., ABC123...XYZ789 (Algorand address)"
                    className="input input-bordered flex-1"
                    value={recoveryForm.newRecipient}
                    onChange={(e) => setRecoveryForm({ ...recoveryForm, newRecipient: e.target.value })}
                  />
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                      if (activeAccount) {
                        setRecoveryForm({ ...recoveryForm, newRecipient: activeAccount.address })
                      }
                    }}
                  >
                    Use My Address
                  </button>
                </div>
                <div className="label">
                  <span className="label-text-alt text-gray-400">
                    💡 Usually your own address, but can be sent to another player's address if needed.
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <button
                className="btn btn-accent"
                onClick={handleRecoverItem}
                disabled={loading || !recoveryForm.originalItemId || !recoveryForm.questProof || !recoveryForm.newRecipient}
              >
                {loading ? 'Recovering...' : 'Recover Item'}
              </button>

              {/* Help Section */}
              <div className="mt-4 p-4 bg-blue-900 bg-opacity-50 rounded-lg">
                <h4 className="text-white font-semibold mb-2">❓ How to find these values:</h4>
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>
                    <strong>Item Asset ID:</strong> Check your Algorand wallet for NFT/ASA IDs, or look in game inventory logs
                  </li>
                  <li>
                    <strong>Quest Proof:</strong> Complete a recovery quest in the game to receive a proof hash
                  </li>
                  <li>
                    <strong>Recipient Address:</strong> Your wallet address (click "Use My Address") or another player's address
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* QR Code Modal */}
        {qrModal.isOpen && (
          <QRModal
            isOpen={qrModal.isOpen}
            title={qrModal.title}
            value={qrModal.value}
            onClose={() => setQrModal({ isOpen: false, title: '', value: '' })}
          />
        )}
      </div>
    </div>
  )
}
