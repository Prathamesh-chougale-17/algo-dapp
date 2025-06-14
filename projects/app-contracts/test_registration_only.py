#!/usr/bin/env python3
"""
Test the registration step specifically (assuming opt-in already done)
"""
import logging
import algokit_utils
from smart_contracts.artifacts.algorealm.algo_realm_game_manager_client import (
    AlgoRealmGameManagerClient,
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_registration_only():
    """Test just the registration step"""
    
    # Initialize Algorand client
    algorand = algokit_utils.AlgorandClient.from_environment()
    deployer = algorand.account.from_environment("DEPLOYER")
    
    try:
        logger.info("🎮 Testing AlgoRealm Registration (Already Opted In)")
        logger.info(f"👤 Deployer: {deployer.address}")
        
        # Connect to the existing app (App ID: 1005)
        app_client = algorand.client.get_typed_app_client_by_id(
            AlgoRealmGameManagerClient,
            app_id=1005,
            default_sender=deployer.address
        )
        
        logger.info(f"📱 App ID: {app_client.app_id}")
        logger.info(f"📍 App Address: {app_client.app_address}")
        
        # Step 1: Register as Game Master (NoOp call)
        logger.info("👑 Registering as Game Master...")
        register_result = app_client.send.register_player(("GameMaster",))
        logger.info(f"✅ Game Master registered successfully!")
        logger.info(f"📝 Registration Transaction ID: {register_result.tx_id}")
        logger.info(f"🎯 Registration Response: {register_result.abi_return}")
        
        # Step 2: Try to register again (should say already registered)
        logger.info("🔄 Trying to register again...")
        duplicate_result = app_client.send.register_player(("GameMaster",))
        logger.info(f"📝 Duplicate Registration Transaction ID: {duplicate_result.tx_id}")
        logger.info(f"🎯 Duplicate Response: {duplicate_result.abi_return}")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Registration failed: {e}")
        return False

if __name__ == "__main__":
    success = test_registration_only()
    if success:
        logger.info("🎉 All tests passed!")
    else:
        logger.error("💥 Tests failed!")
