#!/usr/bin/env python3
"""
Simple test script to interact with the deployed AlgoRealm contract
"""
import logging

import algokit_utils

from smart_contracts.artifacts.algorealm.algo_realm_game_manager_client import (
    AlgoRealmGameManagerClient,
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def test_game_master_registration() -> bool:
    """Test registering the Game Master"""

    # Initialize Algorand client
    algorand = algokit_utils.AlgorandClient.from_environment()
    deployer = algorand.account.from_environment("DEPLOYER")

    # Connect to the deployed contract (App ID: 1001)
    app_client = algorand.client.get_typed_app_client_by_id(
        AlgoRealmGameManagerClient, app_id=1001, default_sender=deployer.address
    )

    try:
        logger.info("🎮 Testing AlgoRealm Game Master Registration")
        logger.info(f"📱 App ID: {app_client.app_id}")
        logger.info(f"📍 App Address: {app_client.app_address}")
        logger.info(
            f"👤 Deployer: {deployer.address}"
        )  # Try to register as Game Master directly (this should handle opt-in automatically)
        logger.info("👑 Attempting to register as Game Master...")
        register_result = app_client.send.register_player(("GameMaster",))
        logger.info("✅ Game Master registered successfully!")
        logger.info(f"📝 Registration Transaction ID: {register_result.tx_id}")
        logger.info(f"🎯 Player ID: {register_result.return_value}")

        return True

    except Exception as e:
        logger.error(f"❌ Registration failed: {e}")
        return False


if __name__ == "__main__":
    test_game_master_registration()
