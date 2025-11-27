import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Ignition module for Ethereum Mainnet deployment
 * 
 * IMPORTANT: Set this environment variable before deployment:
 * - MAINNET_ECM_TOKEN: Address of deployed ECM token
 * 
 * This module only deploys:
 * - ECMLock Contract (connected to existing ECM token)
 * 
 * Configuration:
 * - Lock duration: 365 days (1 year)
 * 
 * Post-deployment steps:
 * 1. Verify contract on Etherscan
 * 2. Test lock creation with small amount
 * 3. Update frontend with contract address
 */

const MainnetDeploymentModule = buildModule("MainnetDeployment", (m) => {
  // ============ Get Existing Contract Address ============
  
  // ECM Token address (MUST be set in parameters or environment)
  const ecmTokenAddress = m.getParameter(
    "ecmTokenAddress",
    process.env.MAINNET_ECM_TOKEN || ""
  );

  // ============ Validation ============
  // Note: Validation of addresses should be done at runtime or via environment setup
  // Ignition modules handle parameter validation automatically

  // ============ Deploy ECMLock Contract ============
  const ecmLock = m.contract("ECMLock", [ecmTokenAddress], {
    id: "ECMLock",
  });

  // ============ Return deployed contract ============
  return {
    ecmLock,
  };
});

export default MainnetDeploymentModule;
