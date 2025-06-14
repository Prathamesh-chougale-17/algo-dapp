import logging
from algosdk.transaction import OnComplete
import algokit_utils

logger = logging.getLogger(__name__)


def deploy() -> None:
    """Deploy the AlgoRealm Gaming System"""
    from smart_contracts.artifacts.algorealm.algo_realm_game_manager_client import (
        AlgoRealmGameManagerFactory,
    )

    algorand = algokit_utils.AlgorandClient.from_environment()
    deployer = algorand.account.from_environment("DEPLOYER")

    # Create the game manager factory
    factory = algorand.client.get_typed_app_factory(
        AlgoRealmGameManagerFactory, 
        default_sender=deployer.address
    )

    # Deploy the contract with initialization
    logger.info("🚀 Deploying AlgoRealm Gaming System...")
    
    # Import the method call params
    from smart_contracts.artifacts.algorealm.algo_realm_game_manager_client import (
        AlgoRealmGameManagerMethodCallCreateParams,
    )
    
    # Create parameters for the initialize_game method
    create_params = AlgoRealmGameManagerMethodCallCreateParams(
        method="initialize_game()string",
        args=None,
    )
    
    app_client, result = factory.deploy(
        on_update=algokit_utils.OnUpdate.AppendApp,
        on_schema_break=algokit_utils.OnSchemaBreak.AppendApp,
        create_params=create_params,
    )
    
    # Force use of the new deployment info
    logger.info(f"🎮 AlgoRealm Game Manager deployed!")
    logger.info(f"📱 App ID: {app_client.app_id}")
    logger.info(f"📍 App Address: {app_client.app_address}")
    logger.info(f"👑 Game Master: {deployer.address}")

    if result.operation_performed in [
        algokit_utils.OperationPerformed.Create,
        algokit_utils.OperationPerformed.Replace,
    ]:
        logger.info(f"🎮 AlgoRealm Game Manager deployed!")
        logger.info(f"📱 App ID: {app_client.app_id}")
        logger.info(f"📍 App Address: {app_client.app_address}")
        logger.info(f"👑 Game Master: {deployer.address}")
        
        # Fund the contract to cover inner transaction fees
        logger.info("💰 Funding contract for inner transactions...")
        try:
            fund_amount = 1_000_000  # 1 ALGO in microAlgos for inner transaction fees
            fund_txn = algorand.create_transaction.payment(
                sender=deployer.address,
                receiver=app_client.app_address,
                amount=fund_amount
            )
            fund_result = algorand.send.payment(fund_txn)
            logger.info(f"✅ Contract funded with {fund_amount} microAlgos")
            logger.info(f"📝 Funding Transaction ID: {fund_result.tx_id}")
        except Exception as e:
            logger.warning(f"⚠️ Could not fund contract: {e}")
        
        # Auto-register the deployer as the first player
        try:
            logger.info("🔐 Opting in to the application...")
            # First opt-in to the application
            opt_in_result = app_client.send.register_player(
                ("GameMaster",),
                params=algokit_utils.CommonAppCallParams(
                    on_complete=OnComplete.OptInOC
                )
            )
            logger.info(f"✅ Opt-in successful: {opt_in_result.abi_return}")
            logger.info(f"📝 Opt-in Transaction ID: {opt_in_result.tx_id}")
            
            # Then register as Game Master
            logger.info("👑 Registering as Game Master...")
            register_result = app_client.send.register_player(("GameMaster",))
            logger.info(f"✅ Game Master registered: {register_result.abi_return}")
            logger.info(f"📝 Registration Transaction ID: {register_result.tx_id}")
            
        except Exception as e:
            logger.warning(f"⚠️ Could not auto-register Game Master: {e}")
            logger.warning(f"You can register manually using the frontend or client")

    else:
        logger.info("📦 AlgoRealm Game Manager already deployed")
        logger.info(f"📱 App ID: {app_client.app_id}")

    # Save deployment info for frontend
    deployment_info = {
        "app_id": app_client.app_id,
        "app_address": app_client.app_address,
        "game_master": deployer.address,
        "network": "localnet"
    }
    
    logger.info("💾 Saving deployment info for frontend...")
    import json
    with open("deployment_info.json", "w") as f:
        json.dump(deployment_info, f, indent=2)
    
    logger.info("🎉 AlgoRealm deployment complete!")
    logger.info("🌐 Ready for frontend integration!")
    
    return app_client, result


if __name__ == "__main__":
    deploy()
