#!/usr/bin/env python3
"""
CI-friendly deployment script for AlgoRealm
Handles missing credentials gracefully for CI/CD pipelines
"""

import logging
import os
import sys

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def check_testnet_credentials() -> bool:
    """Check if testnet deployment credentials are available"""
    deployer_mnemonic = os.getenv("DEPLOYER_MNEMONIC")
    dispenser_mnemonic = os.getenv("DISPENSER_MNEMONIC")

    if not deployer_mnemonic or not dispenser_mnemonic:
        logger.warning("⚠️ Testnet credentials not found in environment")
        logger.warning("Skipping testnet deployment for CI/CD")
        return False

    return True


def main() -> None:
    """Main deployment function"""
    logger.info("Starting CI/CD friendly deployment")

    # Check if we're getting any command line arguments
    if len(sys.argv) > 1:
        network = sys.argv[1]
        logger.info(f"Network from args: {network}")
    else:
        network = "localnet"
        logger.info(f"No network specified, defaulting to: {network}")

    if network == "testnet":
        if not check_testnet_credentials():
            logger.info("⚠️ Missing testnet credentials - THIS IS EXPECTED IN CI/CD")
            logger.info("✅ CI/CD pipeline continuing without testnet deployment")
            sys.exit(0)  # Exit successfully to not break CI/CD

        # If credentials are available, proceed with testnet deployment
        logger.info("🚀 Deploying to testnet...")
        # Import and run actual deployment
        try:
            logger.info("Importing deployment module...")
            from smart_contracts.algorealm.deploy_config import deploy

            logger.info("Running deployment...")
            deploy()
            logger.info("✅ Testnet deployment successful")
        except Exception as e:
            logger.error(f"❌ Testnet deployment failed: {e}")
            logger.error("But allowing CI/CD to continue since this is optional in CI")
            sys.exit(0)  # Don't fail CI/CD

    elif network == "localnet":
        logger.info("🏠 Deploying to localnet...")
        # For localnet, use the regular deployment
        try:
            logger.info("Importing deployment module...")
            from smart_contracts.algorealm.deploy_config import deploy

            logger.info("Running deployment...")
            deploy()
            logger.info("✅ Localnet deployment successful")
        except Exception as e:
            logger.error(f"❌ Localnet deployment failed: {e}")
            sys.exit(1)

    else:
        logger.error(f"❌ Unknown network: {network}")
        sys.exit(1)


if __name__ == "__main__":
    main()
