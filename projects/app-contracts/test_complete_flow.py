#!/usr/bin/env python3
"""
Test the complete registration flow: opt-in + actual registration
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


def test_complete_registration_flow() -> bool:
    """Test the complete registration flow"""

    # Initialize Algorand client
    algorand = algokit_utils.AlgorandClient.from_environment()
    deployer = algorand.account.from_environment("DEPLOYER")

    try:
        logger.info("🎮 Testing Complete AlgoRealm Registration Flow")
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
        logger.info(f"📍 App Address: {app_client.app_address}")

        # Step 1: Opt-in to the application
        logger.info("🔐 Step 1: Opting in to the application...")
        opt_in_result = app_client.send.register_player(
            ("GameMaster",),
            params=algokit_utils.CommonAppCallParams(on_complete=OnComplete.OptInOC),
        )
        logger.info("✅ Opt-in successful!")
        logger.info(f"📝 Opt-in Transaction ID: {opt_in_result.tx_id}")
        logger.info(f"🎯 Opt-in Response: {opt_in_result.abi_return}")

        # Step 2: Actually register as Game Master
        logger.info("👑 Step 2: Registering as Game Master...")
        register_result = app_client.send.register_player(("GameMaster",))
        logger.info("✅ Game Master registered successfully!")
        logger.info(f"📝 Registration Transaction ID: {register_result.tx_id}")
        logger.info(f"🎯 Registration Response: {register_result.abi_return}")

        # Step 3: Try to register again (should say already registered)
        logger.info("🔄 Step 3: Trying to register again...")
        duplicate_result = app_client.send.register_player(("GameMaster",))
        logger.info(
            f"📝 Duplicate Registration Transaction ID: {duplicate_result.tx_id}"
        )
        logger.info(f"🎯 Duplicate Response: {duplicate_result.abi_return}")

        return True

    except Exception as e:
        logger.error(f"❌ Registration failed: {e}")
        return False


if __name__ == "__main__":
    success = test_complete_registration_flow()
    if success:
        logger.info("🎉 All tests passed!")
    else:
        logger.error("💥 Tests failed!")
