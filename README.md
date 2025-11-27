# ECM Token Lock Contract

A simple and secure token locking contract that allows users to lock their ECM tokens for 1 year (365 days). Users can create multiple locks and claim their tokens after the lock period expires.

## 🌟 Features

### For Users
- **Lock ECM Tokens**: Lock your ECM tokens for 1 year (365 days)
- **Multiple Locks**: Each lock operation creates a separate lock entry for flexibility
- **Batch Claiming**: Claim all unlocked tokens at once or specific locks
- **View Locks**: Check all your locks, amounts, release times, and claim status
- **Flexible Claiming**: Choose to claim all unlocked tokens or specific ones

### For Administrators
- **Emergency Withdraw**: Emergency withdrawal function for owner (should only be used in emergency situations)
- **Emergency Pause**: Halt all operations in case of emergency
- **Contract Management**: Pause and unpause contract operations

### Security Features
- ✅ **ReentrancyGuard**: Protection against reentrancy attacks on all state-changing functions
- ✅ **SafeERC20**: Safe token transfer operations
- ✅ **Pausable**: Emergency stop mechanism
- ✅ **Ownable**: Admin-only privileged functions
- ✅ **Immutable Token**: ECM address cannot be changed after deployment
- ✅ **Fixed Lock Duration**: 365-day lock period is constant and cannot be changed

## 📋 Contract Overview

### ECMLock.sol
Main locking contract that handles:
- Token locking for 1 year (365 days)
- Multiple locks per user
- Claiming unlocked tokens
- Admin emergency functions

**Key State Variables:**
- `ecm`: ECM token address (immutable)
- `lockDuration`: Fixed lock duration of 365 days (constant)
- `totalLocked`: Total ECM currently locked across all users
- `_userLocks`: Mapping of user addresses to their lock array

### ECMToken.sol
Simple ERC20 token:
- Name: ECM
- Symbol: ECM
- Decimals: 18
- Initial supply minted to deployer

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- npm or pnpm
- Hardhat
- Sepolia testnet ETH (for testing)
- Ethereum mainnet ETH (for production)

### Installation

```bash
# Clone the repository
git clone https://github.com/salmanblockversedev/simple-purchase-lock.git
cd simple-purchase-lock

# Install dependencies
npm install
# or
pnpm install
```

### Configuration

Create a `.env` file in the root directory:

```env
# Network RPC URLs
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
MAINNET_RPC_URL=https://mainnet.infura.io/v3/YOUR_INFURA_KEY

# Private key for deployment
PRIVATE_KEY=your_private_key_here

# Etherscan API key for verification
ETHERSCAN_API_KEY=your_etherscan_api_key

# Mainnet contract address (for production deployment)
MAINNET_ECM_TOKEN=0x...          # Your ECM token address
```

## 📦 Deployment

### Sepolia Testnet Deployment

Deploy complete test environment (ECM token and Lock contract):

```bash
npm run deploy:testnet
```

This will:
1. Deploy ECMToken (1B supply)
2. Deploy ECMLock contract

### Ethereum Mainnet Deployment

**⚠️ IMPORTANT**: Set environment variable first!

```bash
# Ensure this is set in .env:
# MAINNET_ECM_TOKEN=0x...

npm run deploy:mainnet
```

This will:
1. Validate ECM token address
2. Verify token contract exists
3. Deploy ECMLock contract
4. Display post-deployment checklist

**Post-Deployment Steps:**
1. Verify contract on Etherscan
2. Test locking with a small amount
3. Verify lock is created correctly
4. Update frontend with contract address

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Run all tests
npm test

# Run with gas reporting
npm test -- --trace

# Run specific test file
npx hardhat test test/pool-manager.spec.ts
```

**Test Coverage:**
- ✅ Deployment (5 tests)
- ✅ Lock Tokens (8 tests)
- ✅ View Functions (3 tests)
- ✅ Claim All Unlocked (6 tests)
- ✅ Claim Specific Locks (4 tests)
- ✅ Admin Functions (6 tests)
- ✅ Security & Edge Cases (4 tests)
- **Total: 36 tests (100% passing)**

## 📖 Usage Guide

### For Users

#### 1. Lock ECM Tokens

```solidity
// Approve ECM tokens to lock contract
ecm.approve(address(ecmLock), 1000e18); // 1000 ECM

// Lock tokens for 1 year
ecmLock.lockTokens(1000e18);
```

#### 2. Check Your Locks

```solidity
// Get all locks for your address
(
    uint256[] memory amounts,
    uint256[] memory releaseTimes,
    bool[] memory claimed
) = ecmLock.getUserLocks(msg.sender);

// Display each lock
for (uint256 i = 0; i < amounts.length; i++) {
    console.log("Lock", i);
    console.log("  Amount:", amounts[i]);
    console.log("  Release Time:", releaseTimes[i]);
    console.log("  Claimed:", claimed[i]);
}

// Get lock count
uint256 lockCount = ecmLock.getUserLockCount(msg.sender);
```

#### 3. Claim Unlocked Tokens

```solidity
// Option 1: Claim all unlocked tokens at once
ecmLock.claimAllUnlocked();

// Option 2: Claim specific locks (more gas efficient for many locks)
uint256[] memory indices = new uint256[](2);
indices[0] = 0;  // First lock
indices[1] = 2;  // Third lock
ecmLock.claimLocks(indices);
```

### For Administrators

#### Emergency Withdraw

```solidity
// Check contract balance
uint256 balance = ecm.balanceOf(address(ecmLock));

// Emergency withdraw (only in emergency situations)
ecmLock.emergencyWithdraw(balance);
```

#### Emergency Controls

```solidity
// Pause all operations
ecmLock.pause();

// Resume operations
ecmLock.unpause();
```

## 🔐 Security Considerations

### Audited Features
- ✅ Reentrancy protection on all state-changing functions
- ✅ SafeERC20 for safe token transfers
- ✅ Integer overflow protection (Solidity 0.8+)
- ✅ Access control for admin functions
- ✅ Fixed lock duration (365 days, cannot be changed)

### Best Practices
- Verify lock release times before claiming
- Test on Sepolia testnet before mainnet deployment
- Use multisig wallet for contract ownership on mainnet
- Monitor contract for unusual activity
- Keep track of your lock indices for efficient claiming

### Known Limitations
- Lock duration is fixed at 365 days and cannot be changed
- Emergency withdraw is owner-only and should only be used in emergencies
- Claims require gas; users need ETH for claiming

## 📊 Contract Specifications

### ECMLock Contract

| Property | Value |
|----------|-------|
| Solidity Version | 0.8.19+ |
| License | MIT |
| Optimizer | Enabled (200 runs) |
| Lock Duration | 365 days (constant) |

### Functions

#### User Functions
- `lockTokens(uint256 amount)` - Lock ECM tokens for 1 year
- `claimAllUnlocked()` - Claim all unlocked tokens
- `claimLocks(uint256[] calldata indices)` - Claim specific locks
- `getUserLocks(address user)` - View all locks for a user
- `getUserLockCount(address user)` - Get number of locks for a user

#### Admin Functions
- `emergencyWithdraw(uint256 amount)` - Emergency withdraw (owner only)
- `pause()` / `unpause()` - Emergency controls

### Events

```solidity
event TokensLocked(address indexed user, uint256 amount, uint256 releaseTime, uint256 indexed lockIndex);
event Claim(address indexed beneficiary, uint256 ecmAmount, uint256 indexed lockIndex);
event EmergencyWithdraw(address indexed owner, uint256 amount);
```

## 🛠️ Development

### Compile Contracts

```bash
npm run build
```

### Run Tests

```bash
# All tests
npm test

# With logs
npm test:logs

# Specific test file
npx hardhat test test/security-tests.spec.ts
```

### Lint Solidity

```bash
npm run lint
npm run lint:fix
```

### Flatten Contracts

```bash
npm run flatten
```

### Verify Contracts

```bash
# After deployment
npm run verify:network sepolia
npm run verify:network mainnet
```

## 📁 Project Structure

```
simple-purchase-lock/
├── contracts/
│   ├── ECMLock.sol              # Main lock contract
│   ├── ECMToken.sol             # ECM ERC20 token
│   └── test/
│       ├── MockERC20.sol        # Mock ERC20 for testing
│       ├── MockMaliciousToken.sol # Mock malicious token
│       └── MockMaliciousTokens.sol # Various malicious tokens
├── ignition/
│   └── modules/
│       ├── deploy-sepolia.ts    # Sepolia testnet deployment
│       └── deploy-mainnet.ts    # Mainnet deployment
├── scripts/
│   ├── deploy-sepolia.ts        # Sepolia deployment script
│   └── deploy-mainnet.ts        # Mainnet deployment script
├── test/
│   └── ECMLock.spec.ts          # Comprehensive test suite
├── hardhat.config.ts            # Hardhat configuration
├── package.json                 # Dependencies
└── README.md                    # This file
```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👥 Authors

- **Salman Bao** - [@salmanbao](https://github.com/salmanbao)
- **Organization** - [Blockverse Development](https://github.com/salmanblockversedev)

## 🔗 Links

- [GitHub Repository](https://github.com/salmanblockversedev/simple-purchase-lock)
- [Sepolia Etherscan](https://sepolia.etherscan.io/)
- [Ethereum Etherscan](https://etherscan.io/)

## ⚠️ Disclaimer

This smart contract is provided as-is. Users should conduct their own security audits before deploying to mainnet. The authors are not responsible for any loss of funds or unexpected behavior.

## 📞 Support

For questions, issues, or feature requests:
- Open an issue on [GitHub](https://github.com/salmanblockversedev/simple-purchase-lock/issues)
- Contact: salmancodez@gmail.com

---

**Built with ❤️ by Blockverse Development**
