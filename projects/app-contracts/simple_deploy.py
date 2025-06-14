#!/usr/bin/env python3
"""Simple deployment script for AlgoRealm"""

import base64
import json
import os

from algosdk import account, mnemonic, transaction
from algosdk.transaction import ApplicationCreateTxn, OnComplete, StateSchema
from algosdk.v2client import algod


def get_algod_client() -> algod.AlgodClient:
    """Get algod client for LocalNet"""
    algod_address = "http://localhost:4001"
    algod_token = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    return algod.AlgodClient(algod_token, algod_address)


def get_deployer_account() -> tuple[str, str]:
    """Get deployer account from LocalNet dispenser"""
    # Use LocalNet dispenser account
    mnemonic_phrase = (
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon "
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon "
        "abandon abandon abandon abandon abandon art"
    )
    private_key = mnemonic.to_private_key(mnemonic_phrase)
    address = account.address_from_private_key(private_key)
    return private_key, address


def deploy_contract() -> tuple[int, str]:
    """Deploy the AlgoRealm contract"""
    client = get_algod_client()
    private_key, deployer_address = get_deployer_account()

    print(f"🚀 Deploying AlgoRealm with deployer: {deployer_address}")

    # Read compiled contract files
    approval_program = open(
        "smart_contracts/algorealm/AlgoRealmGameManager.approval.teal"
    ).read()
    clear_program = open(
        "smart_contracts/algorealm/AlgoRealmGameManager.clear.teal"
    ).read()

    # Compile programs
    approval_result = client.compile(approval_program)
    approval_program_bytes = base64.b64decode(approval_result["result"])

    clear_result = client.compile(clear_program)
    clear_program_bytes = base64.b64decode(clear_result["result"])

    # Define schema
    global_schema = StateSchema(
        num_uints=5, num_byte_slices=1
    )  # Adjust based on contract needs
    local_schema = StateSchema(
        num_uints=3, num_byte_slices=1
    )  # Adjust based on contract needs

    # Get suggested params
    params = client.suggested_params()

    # Create application creation transaction
    create_txn = ApplicationCreateTxn(
        sender=deployer_address,
        sp=params,
        on_complete=OnComplete.NoOpOC,
        approval_program=approval_program_bytes,
        clear_program=clear_program_bytes,
        global_schema=global_schema,
        local_schema=local_schema,
        app_args=[b"initialize_game"],  # Call initialize_game method
    )

    # Sign and send transaction
    signed_txn = create_txn.sign(private_key)
    tx_id = client.send_transaction(signed_txn)

    print(f"📝 Creation transaction sent: {tx_id}")

    # Wait for confirmation
    transaction.wait_for_confirmation(client, tx_id, 4)

    # Get application ID
    txn_result = client.pending_transaction_info(tx_id)
    app_id = txn_result["application-index"]
    app_address = transaction.logic_sig_account.address_from_application_id(app_id)

    print("✅ AlgoRealm deployed!")
    print(f"📱 App ID: {app_id}")
    print(f"📍 App Address: {app_address}")

    # Fund the contract for inner transactions
    print("💰 Funding contract for inner transactions...")
    fund_amount = 1_000_000  # 1 ALGO

    fund_txn = transaction.PaymentTxn(
        sender=deployer_address,
        sp=client.suggested_params(),
        receiver=app_address,
        amt=fund_amount,
    )

    signed_fund_txn = fund_txn.sign(private_key)
    fund_tx_id = client.send_transaction(signed_fund_txn)

    print(f"📝 Funding transaction sent: {fund_tx_id}")
    transaction.wait_for_confirmation(client, fund_tx_id, 4)
    print(f"✅ Contract funded with {fund_amount} microAlgos")

    # Save deployment info
    deployment_info = {
        "app_id": app_id,
        "app_address": app_address,
        "game_master": deployer_address,
        "network": "localnet",
    }

    with open("deployment_info.json", "w") as f:
        json.dump(deployment_info, f, indent=2)

    # Also copy to frontend
    frontend_contracts_dir = "../app-frontend/src/contracts/"
    os.makedirs(frontend_contracts_dir, exist_ok=True)

    with open(frontend_contracts_dir + "deployment_info.json", "w") as f:
        json.dump(deployment_info, f, indent=2)

    print("💾 Deployment info saved")
    print("🎉 AlgoRealm deployment complete!")

    return app_id, app_address


if __name__ == "__main__":
    deploy_contract()
