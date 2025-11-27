// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ECMLock
 * @dev Token locking contract for ECM tokens
 * - Users can lock their ECM tokens for 1 year
 * - Users can claim tokens after the lock period expires
 * - Contract is pausable for emergency situations
 * 
 * Security features:
 * - ReentrancyGuard on all state-changing functions
 * - SafeERC20 for safe token transfers
 * - Pausable for emergency control
 * - Owner-only admin functions
 */
contract ECMLock is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    IERC20 public immutable ecm;

    uint256 public constant lockDuration = 365 days;

    struct Lock {
        uint256 amount;
        uint256 releaseTime;
        bool claimed;
    }

    // per-user locks
    mapping(address => Lock[]) private _userLocks;
    // total amount currently locked (sum of unclaimed locked amounts)
    uint256 public totalLocked;

    // ============ Events ============

    event TokensLocked(
        address indexed user,
        uint256 amount,
        uint256 releaseTime,
        uint256 indexed lockIndex
    );
    event Claim(
        address indexed beneficiary,
        uint256 ecmAmount,
        uint256 indexed lockIndex
    );
    event EmergencyWithdraw(address indexed owner, uint256 amount);

    // ============ Constructor ============

    constructor(address _ecm) Ownable(msg.sender) {
        require(_ecm != address(0), "zero addr");
        ecm = IERC20(_ecm);
    }

    // ============ View Functions ============

    /**
     * @notice Get all locks for a user
     * @param user Address to query locks for
     * @return amounts Array of lock amounts
     * @return releaseTimes Array of lock release timestamps
     * @return claimed Array of claimed status
     */
    function getUserLocks(address user) external view returns (
        uint256[] memory amounts,
        uint256[] memory releaseTimes,
        bool[] memory claimed
    ) {
        Lock[] storage locks = _userLocks[user];
        uint256 n = locks.length;
        amounts = new uint256[](n);
        releaseTimes = new uint256[](n);
        claimed = new bool[](n);
        
        for (uint256 i = 0; i < n; i++) {
            Lock storage L = locks[i];
            amounts[i] = L.amount;
            releaseTimes[i] = L.releaseTime;
            claimed[i] = L.claimed;
        }
    }

    /**
     * @notice Get total number of locks for a user
     * @param user Address to query
     * @return Number of locks
     */
    function getUserLockCount(address user) external view returns (uint256) {
        return _userLocks[user].length;
    }

    // ============ User Functions ============

    /**
     * @notice Lock ECM tokens for 1 year
     * @dev User must approve ECM tokens beforehand
     * @param amount Amount of ECM tokens to lock
     */
    function lockTokens(uint256 amount) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        require(amount > 0, "zero amount");
        
        // Transfer ECM from user to contract
        ecm.safeTransferFrom(msg.sender, address(this), amount);
        
        // Create lock
        uint256 releaseTime = block.timestamp + lockDuration;
        _userLocks[msg.sender].push(Lock({
            amount: amount,
            releaseTime: releaseTime,
            claimed: false
        }));
        uint256 lockIndex = _userLocks[msg.sender].length - 1;
        totalLocked += amount;
        
        emit TokensLocked(msg.sender, amount, releaseTime, lockIndex);
    }

    /**
     * @notice Claim all unlocked tokens
     * @dev Iterates through all locks and claims those that are unlocked
     */
    function claimAllUnlocked() external nonReentrant whenNotPaused {
        Lock[] storage locks = _userLocks[msg.sender];
        uint256 n = locks.length;
        require(n > 0, "no locks");
        
        uint256 totalToTransfer = 0;
        for (uint256 i = 0; i < n; i++) {
            if (!locks[i].claimed && locks[i].releaseTime <= block.timestamp) {
                locks[i].claimed = true;
                totalToTransfer += locks[i].amount;
                emit Claim(msg.sender, locks[i].amount, i);
            }
        }
        
        require(totalToTransfer > 0, "nothing unlocked");
        totalLocked -= totalToTransfer;
        IERC20(ecm).safeTransfer(msg.sender, totalToTransfer);
    }

    /**
     * @notice Claim specific locks by index
     * @dev More gas efficient when user has many locks
     * @param indices Array of lock indices to claim
     */
    function claimLocks(uint256[] calldata indices) external nonReentrant whenNotPaused {
        Lock[] storage locks = _userLocks[msg.sender];
        uint256 n = locks.length;
        uint256 totalToTransfer = 0;
        
        for (uint256 i = 0; i < indices.length; i++) {
            uint256 idx = indices[i];
            require(idx < n, "invalid index");
            Lock storage L = locks[idx];
            require(!L.claimed, "already claimed");
            require(L.releaseTime <= block.timestamp, "not yet unlocked");
            
            L.claimed = true;
            totalToTransfer += L.amount;
            emit Claim(msg.sender, L.amount, idx);
        }
        
        require(totalToTransfer > 0, "nothing to claim");
        totalLocked -= totalToTransfer;
        IERC20(ecm).safeTransfer(msg.sender, totalToTransfer);
    }

    // ============ Admin Functions ============

    /**
     * @notice Emergency withdraw function for owner
     * @dev Only owner can call. Should only be used in emergency situations.
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner nonReentrant {
        uint256 balance = ecm.balanceOf(address(this));
        require(amount <= balance, "amount > balance");
        ecm.safeTransfer(msg.sender, amount);
        emit EmergencyWithdraw(msg.sender, amount);
    }

    /**
     * @notice Pause contract (emergency)
     * @dev Only owner can call. Prevents buy and claim operations.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause contract
     * @dev Only owner can call
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}
