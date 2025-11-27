import { ethers } from "hardhat";
import { parseEther } from "ethers";

/**
 * Deployment script for Sepolia Testnet
 * 
 * This script deploys:
 * 1. Test ECM Token (1B supply)
 * 2. ECMLock Contract
 * 
 * Configuration:
 * - Lock duration: 365 days (1 year)
 * - Simple token locking mechanism
 */

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("================================================");
  console.log("🚀 Deploying to Sepolia Testnet");
  console.log("================================================");
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("");

  // ============ Step 1: Deploy Test ECM Token ============
  console.log("📝 Step 1: Deploying Test ECM Token...");
  const ECMTokenFactory = await ethers.getContractFactory("ECMToken");
  const initialSupply = parseEther("1000000000"); // 1 Billion tokens
  const ecmToken = await ECMTokenFactory.deploy(initialSupply);
  await ecmToken.waitForDeployment();
  const ecmAddress = await ecmToken.getAddress();
  console.log("✅ ECM Token deployed to:", ecmAddress);
  console.log("   Initial supply:", ethers.formatEther(initialSupply), "ECM");
  console.log("");

  // ============ Step 2: Deploy ECMLock Contract ============
  console.log("📝 Step 2: Deploying ECMLock Contract...");
  const ECMLockFactory = await ethers.getContractFactory("ECMLock");
  const lockContract = await ECMLockFactory.deploy(ecmAddress);
  await lockContract.waitForDeployment();
  const lockAddress = await lockContract.getAddress();
  console.log("✅ ECMLock deployed to:", lockAddress);
  console.log("   Lock duration:", (await lockContract.lockDuration()).toString(), "seconds (365 days / 1 year)");
  console.log("");

  // ============ Deployment Summary ============
  console.log("================================================");
  console.log("✅ DEPLOYMENT COMPLETE - SEPOLIA TESTNET");
  console.log("================================================");
  console.log("");
  console.log("📋 Contract Addresses:");
  console.log("─────────────────────────────────────────────");
  console.log("ECM Token:   ", ecmAddress);
  console.log("ECMLock:     ", lockAddress);
  console.log("");
  console.log("📊 Configuration:");
  console.log("─────────────────────────────────────────────");
  console.log("Total ECM Supply:     ", ethers.formatEther(initialSupply), "ECM");
  console.log("Lock Duration:        ", "365 days (1 year)");
  console.log("Contract Owner:       ", await lockContract.owner());
  console.log("");
  console.log("🔗 Verify on Etherscan:");
  console.log("─────────────────────────────────────────────");
  console.log(`npx hardhat verify --network sepolia ${ecmAddress} "${initialSupply}"`);
  console.log(`npx hardhat verify --network sepolia ${lockAddress} "${ecmAddress}"`);
  console.log("");
  console.log("💡 Next Steps:");
  console.log("─────────────────────────────────────────────");
  console.log("1. Verify contracts on Etherscan using commands above");
  console.log("2. Test locking tokens:");
  console.log("   - Approve ECM tokens to lock contract");
  console.log("   - Call lockTokens(amount)");
  console.log("3. Test claiming after 1 year (on testnet, fast forward time)");
  console.log("4. Update frontend with contract addresses");
  console.log("");
  console.log("📝 Save these addresses to your .env file:");
  console.log("─────────────────────────────────────────────");
  console.log(`SEPOLIA_ECM_TOKEN=${ecmAddress}`);
  console.log(`SEPOLIA_ECM_LOCK=${lockAddress}`);
  console.log("================================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });
