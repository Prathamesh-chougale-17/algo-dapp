import { useWallet } from '@txnlab/use-wallet-react'
import React, { useState } from 'react'
import AlgoRealmGame from './components/AlgoRealmGame'
import ConnectWallet from './components/ConnectWallet'

interface HomeProps {}

const Home: React.FC<HomeProps> = () => {
  const [openWalletModal, setOpenWalletModal] = useState<boolean>(false)
  const { activeAccount } = useWallet()

  const toggleWalletModal = () => {
    setOpenWalletModal(!openWalletModal)
  }

  return (
    <>
      <ConnectWallet openModal={openWalletModal} closeModal={toggleWalletModal} />
      {activeAccount ? (
        <AlgoRealmGame onOpenWalletModal={toggleWalletModal} />
      ) : (
        <div className="hero min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
          <div className="hero-content text-center">
            <div className="max-w-md">
              <h1 className="text-5xl font-bold text-white mb-8">🗡️ AlgoRealm</h1>
              <p className="text-xl text-gray-300 mb-8">A blockchain gaming system on Algorand featuring on-demand tokenization</p>
              <button className="btn btn-primary btn-lg" onClick={toggleWalletModal}>
                Connect Wallet to Enter
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Home
