#!/usr/bin/env python3
"""Fund the AlgoRealm contract"""

from algosdk.v2client import algod
from algosdk import transaction, account, mnemonic

def get_algod_client():
    """Get algod client for LocalNet"""
    algod_address = "http://localhost:4001"
    algod_token = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    return algod.AlgodClient(algod_token, algod_address)

def get_deployer_account():
    """Get deployer account from LocalNet dispenser"""
    # Use LocalNet dispenser account
    mnemonic_phrase = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon ability"
    private_key = mnemonic.to_private_key(mnemonic_phrase)
    address = account.address_from_private_key(private_key)
    return private_key, address

def fund_contract():
    """Fund the AlgoRealm contract"""
    client = get_algod_client()
    private_key, deployer_address = get_deployer_account()
    
    # Contract address from deployment
    contract_address = "TRWQJHM24P64L2XY35IFCQ4DXGMBBVKB5VP6IVDRSQYN22R2VTBHTR7JB4"
    
    print(f"💰 Funding contract at: {contract_address}")
    print(f"🏦 From deployer: {deployer_address}")
    
    # Fund the contract for inner transactions
    fund_amount = 2_000_000  # 2 ALGO to cover minimum balance + inner transaction fees
    
    fund_txn = transaction.PaymentTxn(
        sender=deployer_address,
        sp=client.suggested_params(),
        receiver=contract_address,
        amt=fund_amount
    )
    
    signed_fund_txn = fund_txn.sign(private_key)
    fund_tx_id = client.send_transaction(signed_fund_txn)
    
    print(f"📝 Funding transaction sent: {fund_tx_id}")
    transaction.wait_for_confirmation(client, fund_tx_id, 4)
    print(f"✅ Contract funded with {fund_amount} microAlgos")
    
    # Check balance
    account_info = client.account_info(contract_address)
    print(f"💳 Contract balance: {account_info['amount']} microAlgos")

if __name__ == "__main__":
    fund_contract()
