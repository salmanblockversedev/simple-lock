import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { parseEther } from "ethers";

/**
 * Ignition module for Sepolia Testnet deployment
 * 
 * Deploys:
 * 1. Test ECM Token (1B supply)
 * 2. ECMLock Contract
 * 
 * Configuration:
 * - Lock duration: 365 days (1 year)
 * - Simple token locking mechanism
 */

const SepoliaDeploymentModule = buildModule("SepoliaDeployment", (m) => {
  // ============ Parameters ============
  const initialECMSupply = m.getParameter("initialECMSupply", parseEther("1000000000")); // 1B ECM

  // ============ Step 1: Deploy Test ECM Token ============
  const ecmToken = m.contract("ECMToken", [initialECMSupply], {
    id: "ECMToken",
  });

  // ============ Step 2: Deploy ECMLock Contract ============
  const ecmLock = m.contract("ECMLock", [ecmToken], {
    id: "ECMLock",
    after: [ecmToken],
  });

  // ============ Return deployed contracts ============
  return {
    ecmToken,
    ecmLock,
  };
});

export default SepoliaDeploymentModule;
