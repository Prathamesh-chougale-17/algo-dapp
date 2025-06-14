#!/usr/bin/env python3
"""
Simple test script to interact with the deployed AlgoRealm contract
"""
import logging

import algokit_utils
from algosdk.transaction import OnComplete

from smart_contracts.artifacts.algorealm.algo_realm_game_manager_client import (
    AlgoRealmGameManagerFactory,
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def test_game_master_registration() -> bool:
    """Test registering the Game Master"""

    # Initialize Algorand client
    algorand = algokit_utils.AlgorandClient.from_environment()
    deployer = algorand.account.from_environment("DEPLOYER")

    try:
        logger.info("🎮 Testing AlgoRealm Game Master Registration")
        logger.info(f"👤 Deployer: {deployer.address}")

        # Deploy the contract first
        factory = algorand.client.get_typed_app_factory(
            AlgoRealmGameManagerFactory, default_sender=deployer.address
        )

        logger.info("🚀 Deploying AlgoRealm contract...")
        app_client, result = factory.deploy(
            on_update=algokit_utils.OnUpdate.AppendApp,
            on_schema_break=algokit_utils.OnSchemaBreak.AppendApp,
        )

        logger.info(f"📱 App ID: {app_client.app_id}")
        logger.info(
            f"📍 App Address: {app_client.app_address}"
        )  # Try to register as Game Master directly with opt-in
        logger.info("� Attempting to register as Game Master with opt-in...")
        register_result = app_client.send.register_player(
            ("GameMaster",),
            params=algokit_utils.CommonAppCallParams(on_complete=OnComplete.OptInOC),
        )
        logger.info("✅ Game Master registered successfully!")
        logger.info(f"📝 Registration Transaction ID: {register_result.tx_id}")
        logger.info(f"🎯 Response: {register_result.abi_return}")

        return True

    except Exception as e:
        logger.error(f"❌ Registration failed: {e}")
        return False


if __name__ == "__main__":
    test_game_master_registration()
