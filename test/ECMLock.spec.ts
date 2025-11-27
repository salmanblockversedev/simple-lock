import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

describe("ECMLock - Token Locking Contract", function () {
  // Fixture to deploy all contracts
  async function deployFixture() {
    const [owner, user1, user2, user3] = await ethers.getSigners();

    // Deploy ECM Token with 1 billion initial supply
    const ECMTokenFactory = await ethers.getContractFactory("ECMToken");
    const initialSupply = ethers.parseEther("1000000000"); // 1B tokens
    const ecmToken = await ECMTokenFactory.deploy(initialSupply);

    // Deploy ECMLock Contract
    const ECMLockFactory = await ethers.getContractFactory("ECMLock");
    const lockContract = await ECMLockFactory.deploy(await ecmToken.getAddress());

    // Transfer some ECM to users for testing
    await ecmToken.transfer(user1.address, ethers.parseEther("100000")); // 100k ECM
    await ecmToken.transfer(user2.address, ethers.parseEther("100000")); // 100k ECM
    await ecmToken.transfer(user3.address, ethers.parseEther("100000")); // 100k ECM

    return { ecmToken, lockContract, owner, user1, user2, user3 };
  }

  describe("Deployment", function () {
    it("Should deploy with correct ECM token address", async function () {
      const { lockContract, ecmToken } = await loadFixture(deployFixture);

      expect(await lockContract.ecm()).to.equal(await ecmToken.getAddress());
    });

    it("Should have correct lock duration (365 days)", async function () {
      const { lockContract } = await loadFixture(deployFixture);

      expect(await lockContract.lockDuration()).to.equal(365 * 24 * 60 * 60);
    });

    it("Should set owner correctly", async function () {
      const { lockContract, owner } = await loadFixture(deployFixture);

      expect(await lockContract.owner()).to.equal(owner.address);
    });

    it("Should initialize with zero total locked", async function () {
      const { lockContract } = await loadFixture(deployFixture);

      expect(await lockContract.totalLocked()).to.equal(0);
    });

    it("Should revert deployment with zero address", async function () {
      const ECMLockFactory = await ethers.getContractFactory("ECMLock");

      await expect(
        ECMLockFactory.deploy(ethers.ZeroAddress)
      ).to.be.revertedWith("zero addr");
    });
  });

  describe("Lock Tokens", function () {
    it("Should allow user to lock tokens", async function () {
      const { lockContract, ecmToken, user1 } = await loadFixture(deployFixture);

      const lockAmount = ethers.parseEther("1000");

      // Approve and lock
      await ecmToken.connect(user1).approve(await lockContract.getAddress(), lockAmount);
      const tx = await lockContract.connect(user1).lockTokens(lockAmount);

      // Check balance transferred
      expect(await ecmToken.balanceOf(await lockContract.getAddress())).to.equal(lockAmount);

      // Check totalLocked updated
      expect(await lockContract.totalLocked()).to.equal(lockAmount);

      // Check event emitted
      const block = await ethers.provider.getBlock("latest");
      const expectedReleaseTime = BigInt(block!.timestamp) + BigInt(365 * 24 * 60 * 60);
      
      await expect(tx)
        .to.emit(lockContract, "TokensLocked")
        .withArgs(user1.address, lockAmount, expectedReleaseTime, 0);
    });

    it("Should create lock with correct release time (1 year)", async function () {
      const { lockContract, ecmToken, user1 } = await loadFixture(deployFixture);

      const lockAmount = ethers.parseEther("1000");
      
      await ecmToken.connect(user1).approve(await lockContract.getAddress(), lockAmount);
      
      const blockBefore = await ethers.provider.getBlock("latest");
      await lockContract.connect(user1).lockTokens(lockAmount);

      const [amounts, releaseTimes, claimed] = await lockContract.getUserLocks(user1.address);
      
      const expectedReleaseTime = BigInt(blockBefore!.timestamp + 1) + BigInt(365 * 24 * 60 * 60);
      expect(releaseTimes[0]).to.be.closeTo(expectedReleaseTime, 5);
      expect(amounts[0]).to.equal(lockAmount);
      expect(claimed[0]).to.be.false;
    });

    it("Should allow multiple locks by same user", async function () {
      const { lockContract, ecmToken, user1 } = await loadFixture(deployFixture);

      const lockAmount = ethers.parseEther("1000");

      // Make 3 locks
      await ecmToken.connect(user1).approve(await lockContract.getAddress(), lockAmount * 3n);
      await lockContract.connect(user1).lockTokens(lockAmount);
      await lockContract.connect(user1).lockTokens(lockAmount);
      await lockContract.connect(user1).lockTokens(lockAmount);

      const [amounts] = await lockContract.getUserLocks(user1.address);
      expect(amounts.length).to.equal(3);
      expect(await lockContract.totalLocked()).to.equal(lockAmount * 3n);
    });

    it("Should handle locks from multiple users", async function () {
      const { lockContract, ecmToken, user1, user2 } = await loadFixture(deployFixture);

      const lockAmount = ethers.parseEther("1000");

      // User1 locks
      await ecmToken.connect(user1).approve(await lockContract.getAddress(), lockAmount);
      await lockContract.connect(user1).lockTokens(lockAmount);

      // User2 locks
      await ecmToken.connect(user2).approve(await lockContract.getAddress(), lockAmount);
      await lockContract.connect(user2).lockTokens(lockAmount);

      const [user1Amounts] = await lockContract.getUserLocks(user1.address);
      const [user2Amounts] = await lockContract.getUserLocks(user2.address);

      expect(user1Amounts.length).to.equal(1);
      expect(user2Amounts.length).to.equal(1);
      expect(await lockContract.totalLocked()).to.equal(lockAmount * 2n);
    });

    it("Should revert when amount is zero", async function () {
      const { lockContract, user1 } = await loadFixture(deployFixture);

      await expect(
        lockContract.connect(user1).lockTokens(0)
      ).to.be.revertedWith("zero amount");
    });

    it("Should revert when insufficient balance", async function () {
      const { lockContract, ecmToken, user1 } = await loadFixture(deployFixture);

      const tooMuchAmount = ethers.parseEther("200000"); // User has only 100k

      await ecmToken.connect(user1).approve(await lockContract.getAddress(), tooMuchAmount);

      await expect(
        lockContract.connect(user1).lockTokens(tooMuchAmount)
      ).to.be.reverted;
    });

    it("Should revert when insufficient allowance", async function () {
      const { lockContract, user1 } = await loadFixture(deployFixture);

      const lockAmount = ethers.parseEther("1000");

      // No approval
      await expect(
        lockContract.connect(user1).lockTokens(lockAmount)
      ).to.be.reverted;
    });

    it("Should revert when contract is paused", async function () {
      const { lockContract, ecmToken, user1, owner } = await loadFixture(deployFixture);

      const lockAmount = ethers.parseEther("1000");
      await ecmToken.connect(user1).approve(await lockContract.getAddress(), lockAmount);

      // Pause contract
      await lockContract.connect(owner).pause();

      await expect(
        lockContract.connect(user1).lockTokens(lockAmount)
      ).to.be.revertedWithCustomError(lockContract, "EnforcedPause");
    });
  });

  describe("View Functions", function () {
    it("Should return empty arrays for user with no locks", async function () {
      const { lockContract, user1 } = await loadFixture(deployFixture);

      const [amounts, releaseTimes, claimed] = await lockContract.getUserLocks(user1.address);

      expect(amounts.length).to.equal(0);
      expect(releaseTimes.length).to.equal(0);
      expect(claimed.length).to.equal(0);
    });

    it("Should return correct lock count", async function () {
      const { lockContract, ecmToken, user1 } = await loadFixture(deployFixture);

      expect(await lockContract.getUserLockCount(user1.address)).to.equal(0);

      const lockAmount = ethers.parseEther("1000");
      await ecmToken.connect(user1).approve(await lockContract.getAddress(), lockAmount * 3n);
      
      await lockContract.connect(user1).lockTokens(lockAmount);
      expect(await lockContract.getUserLockCount(user1.address)).to.equal(1);

      await lockContract.connect(user1).lockTokens(lockAmount);
      expect(await lockContract.getUserLockCount(user1.address)).to.equal(2);

      await lockContract.connect(user1).lockTokens(lockAmount);
      expect(await lockContract.getUserLockCount(user1.address)).to.equal(3);
    });

    it("Should return all locks with correct data", async function () {
      const { lockContract, ecmToken, user1 } = await loadFixture(deployFixture);

      const amounts = [
        ethers.parseEther("1000"),
        ethers.parseEther("2000"),
        ethers.parseEther("500")
      ];

      const totalAmount = amounts.reduce((a, b) => a + b, 0n);
      await ecmToken.connect(user1).approve(await lockContract.getAddress(), totalAmount);

      for (const amount of amounts) {
        await lockContract.connect(user1).lockTokens(amount);
      }

      const [returnedAmounts, releaseTimes, claimed] = await lockContract.getUserLocks(user1.address);

      expect(returnedAmounts.length).to.equal(3);
      expect(returnedAmounts[0]).to.equal(amounts[0]);
      expect(returnedAmounts[1]).to.equal(amounts[1]);
      expect(returnedAmounts[2]).to.equal(amounts[2]);

      expect(claimed[0]).to.be.false;
      expect(claimed[1]).to.be.false;
      expect(claimed[2]).to.be.false;

      expect(releaseTimes[1]).to.be.gte(releaseTimes[0]);
      expect(releaseTimes[2]).to.be.gte(releaseTimes[1]);
    });
  });

  describe("Claim All Unlocked", function () {
    it("Should allow claiming after 1 year", async function () {
      const { lockContract, ecmToken, user1 } = await loadFixture(deployFixture);

      const lockAmount = ethers.parseEther("1000");

      await ecmToken.connect(user1).approve(await lockContract.getAddress(), lockAmount);
      await lockContract.connect(user1).lockTokens(lockAmount);

      // Fast forward 1 year
      await time.increase(365 * 24 * 60 * 60);

      // Claim
      await lockContract.connect(user1).claimAllUnlocked();

      // Check tokens received
      expect(await ecmToken.balanceOf(user1.address)).to.equal(ethers.parseEther("100000")); // Got back the 1000

      // Check lock marked as claimed
      const [, , claimed] = await lockContract.getUserLocks(user1.address);
      expect(claimed[0]).to.be.true;

      // Check totalLocked updated
      expect(await lockContract.totalLocked()).to.equal(0);
    });

    it("Should claim multiple unlocked locks", async function () {
      const { lockContract, ecmToken, user1 } = await loadFixture(deployFixture);

      const lockAmount = ethers.parseEther("1000");

      await ecmToken.connect(user1).approve(await lockContract.getAddress(), lockAmount * 3n);
      await lockContract.connect(user1).lockTokens(lockAmount);
      await lockContract.connect(user1).lockTokens(lockAmount);
      await lockContract.connect(user1).lockTokens(lockAmount);

      await time.increase(365 * 24 * 60 * 60);

      const balanceBefore = await ecmToken.balanceOf(user1.address);
      await lockContract.connect(user1).claimAllUnlocked();

      expect(await ecmToken.balanceOf(user1.address)).to.equal(balanceBefore + lockAmount * 3n);

      const [, , claimed] = await lockContract.getUserLocks(user1.address);
      expect(claimed[0]).to.be.true;
      expect(claimed[1]).to.be.true;
      expect(claimed[2]).to.be.true;
    });

    it("Should revert when no locks exist", async function () {
      const { lockContract, user1 } = await loadFixture(deployFixture);

      await expect(
        lockContract.connect(user1).claimAllUnlocked()
      ).to.be.revertedWith("no locks");
    });

    it("Should revert when nothing is unlocked yet", async function () {
      const { lockContract, ecmToken, user1 } = await loadFixture(deployFixture);

      const lockAmount = ethers.parseEther("1000");
      await ecmToken.connect(user1).approve(await lockContract.getAddress(), lockAmount);
      await lockContract.connect(user1).lockTokens(lockAmount);

      // Try immediately
      await expect(
        lockContract.connect(user1).claimAllUnlocked()
      ).to.be.revertedWith("nothing unlocked");

      // Try after 6 months
      await time.increase(180 * 24 * 60 * 60);
      await expect(
        lockContract.connect(user1).claimAllUnlocked()
      ).to.be.revertedWith("nothing unlocked");
    });

    it("Should prevent double claiming", async function () {
      const { lockContract, ecmToken, user1 } = await loadFixture(deployFixture);

      const lockAmount = ethers.parseEther("1000");
      await ecmToken.connect(user1).approve(await lockContract.getAddress(), lockAmount);
      await lockContract.connect(user1).lockTokens(lockAmount);

      await time.increase(365 * 24 * 60 * 60);

      await lockContract.connect(user1).claimAllUnlocked();

      await expect(
        lockContract.connect(user1).claimAllUnlocked()
      ).to.be.revertedWith("nothing unlocked");
    });

    it("Should revert when paused", async function () {
      const { lockContract, ecmToken, user1, owner } = await loadFixture(deployFixture);

      const lockAmount = ethers.parseEther("1000");
      await ecmToken.connect(user1).approve(await lockContract.getAddress(), lockAmount);
      await lockContract.connect(user1).lockTokens(lockAmount);

      await time.increase(365 * 24 * 60 * 60);

      await lockContract.connect(owner).pause();

      await expect(
        lockContract.connect(user1).claimAllUnlocked()
      ).to.be.revertedWithCustomError(lockContract, "EnforcedPause");
    });
  });

  describe("Claim Specific Locks", function () {
    it("Should claim specific locks by index", async function () {
      const { lockContract, ecmToken, user1 } = await loadFixture(deployFixture);

      const lockAmount = ethers.parseEther("1000");

      await ecmToken.connect(user1).approve(await lockContract.getAddress(), lockAmount * 5n);
      for (let i = 0; i < 5; i++) {
        await lockContract.connect(user1).lockTokens(lockAmount);
      }

      await time.increase(365 * 24 * 60 * 60);

      // Claim only indices 1, 3
      const balanceBefore = await ecmToken.balanceOf(user1.address);
      await lockContract.connect(user1).claimLocks([1, 3]);

      expect(await ecmToken.balanceOf(user1.address)).to.equal(balanceBefore + lockAmount * 2n);

      const [, , claimed] = await lockContract.getUserLocks(user1.address);
      expect(claimed[0]).to.be.false;
      expect(claimed[1]).to.be.true;
      expect(claimed[2]).to.be.false;
      expect(claimed[3]).to.be.true;
      expect(claimed[4]).to.be.false;
    });

    it("Should revert when index is invalid", async function () {
      const { lockContract, ecmToken, user1 } = await loadFixture(deployFixture);

      const lockAmount = ethers.parseEther("1000");
      await ecmToken.connect(user1).approve(await lockContract.getAddress(), lockAmount);
      await lockContract.connect(user1).lockTokens(lockAmount);

      await time.increase(365 * 24 * 60 * 60);

      await expect(
        lockContract.connect(user1).claimLocks([5])
      ).to.be.revertedWith("invalid index");
    });

    it("Should revert when lock not yet unlocked", async function () {
      const { lockContract, ecmToken, user1 } = await loadFixture(deployFixture);

      const lockAmount = ethers.parseEther("1000");
      await ecmToken.connect(user1).approve(await lockContract.getAddress(), lockAmount);
      await lockContract.connect(user1).lockTokens(lockAmount);

      await expect(
        lockContract.connect(user1).claimLocks([0])
      ).to.be.revertedWith("not yet unlocked");
    });

    it("Should revert when lock already claimed", async function () {
      const { lockContract, ecmToken, user1 } = await loadFixture(deployFixture);

      const lockAmount = ethers.parseEther("1000");
      await ecmToken.connect(user1).approve(await lockContract.getAddress(), lockAmount);
      await lockContract.connect(user1).lockTokens(lockAmount);

      await time.increase(365 * 24 * 60 * 60);

      await lockContract.connect(user1).claimLocks([0]);

      await expect(
        lockContract.connect(user1).claimLocks([0])
      ).to.be.revertedWith("already claimed");
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to emergency withdraw", async function () {
      const { lockContract, ecmToken, user1, owner } = await loadFixture(deployFixture);

      const lockAmount = ethers.parseEther("1000");
      await ecmToken.connect(user1).approve(await lockContract.getAddress(), lockAmount);
      await lockContract.connect(user1).lockTokens(lockAmount);

      const ownerBalanceBefore = await ecmToken.balanceOf(owner.address);
      const withdrawAmount = ethers.parseEther("500");
      
      await lockContract.connect(owner).emergencyWithdraw(withdrawAmount);

      const ownerBalanceAfter = await ecmToken.balanceOf(owner.address);
      expect(ownerBalanceAfter).to.equal(ownerBalanceBefore + withdrawAmount);
    });

    it("Should revert emergency withdraw when amount exceeds balance", async function () {
      const { lockContract, owner } = await loadFixture(deployFixture);

      await expect(
        lockContract.connect(owner).emergencyWithdraw(ethers.parseEther("1000"))
      ).to.be.revertedWith("amount > balance");
    });

    it("Should only allow owner to emergency withdraw", async function () {
      const { lockContract, user1 } = await loadFixture(deployFixture);

      await expect(
        lockContract.connect(user1).emergencyWithdraw(ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(lockContract, "OwnableUnauthorizedAccount");
    });

    it("Should allow owner to pause", async function () {
      const { lockContract, owner } = await loadFixture(deployFixture);

      await lockContract.connect(owner).pause();
      expect(await lockContract.paused()).to.be.true;
    });

    it("Should allow owner to unpause", async function () {
      const { lockContract, owner } = await loadFixture(deployFixture);

      await lockContract.connect(owner).pause();
      await lockContract.connect(owner).unpause();
      expect(await lockContract.paused()).to.be.false;
    });

    it("Should only allow owner to pause/unpause", async function () {
      const { lockContract, user1 } = await loadFixture(deployFixture);

      await expect(
        lockContract.connect(user1).pause()
      ).to.be.revertedWithCustomError(lockContract, "OwnableUnauthorizedAccount");

      await expect(
        lockContract.connect(user1).unpause()
      ).to.be.revertedWithCustomError(lockContract, "OwnableUnauthorizedAccount");
    });
  });

  describe("Security & Edge Cases", function () {
    it("Should keep locks isolated between users", async function () {
      const { lockContract, ecmToken, user1, user2 } = await loadFixture(deployFixture);

      const lockAmount = ethers.parseEther("1000");

      await ecmToken.connect(user1).approve(await lockContract.getAddress(), lockAmount);
      await lockContract.connect(user1).lockTokens(lockAmount);

      await time.increase(365 * 24 * 60 * 60);

      // User2 cannot claim user1's locks
      await expect(
        lockContract.connect(user2).claimAllUnlocked()
      ).to.be.revertedWith("no locks");

      // User1 can claim their own locks
      await expect(
        lockContract.connect(user1).claimAllUnlocked()
      ).to.not.be.reverted;
    });

    it("Should correctly track totalLocked across multiple users", async function () {
      const { lockContract, ecmToken, user1, user2, user3 } = await loadFixture(deployFixture);

      const amount1 = ethers.parseEther("1000");
      const amount2 = ethers.parseEther("2000");
      const amount3 = ethers.parseEther("1500");

      await ecmToken.connect(user1).approve(await lockContract.getAddress(), amount1);
      await lockContract.connect(user1).lockTokens(amount1);

      await ecmToken.connect(user2).approve(await lockContract.getAddress(), amount2);
      await lockContract.connect(user2).lockTokens(amount2);

      await ecmToken.connect(user3).approve(await lockContract.getAddress(), amount3);
      await lockContract.connect(user3).lockTokens(amount3);

      expect(await lockContract.totalLocked()).to.equal(amount1 + amount2 + amount3);

      await time.increase(365 * 24 * 60 * 60);

      await lockContract.connect(user1).claimAllUnlocked();
      expect(await lockContract.totalLocked()).to.equal(amount2 + amount3);

      await lockContract.connect(user2).claimAllUnlocked();
      expect(await lockContract.totalLocked()).to.equal(amount3);

      await lockContract.connect(user3).claimAllUnlocked();
      expect(await lockContract.totalLocked()).to.equal(0);
    });

    it("Should handle large number of locks per user", async function () {
      const { lockContract, ecmToken, user1 } = await loadFixture(deployFixture);

      const lockAmount = ethers.parseEther("100");
      const numLocks = 20;

      await ecmToken.connect(user1).approve(await lockContract.getAddress(), lockAmount * BigInt(numLocks));

      for (let i = 0; i < numLocks; i++) {
        await lockContract.connect(user1).lockTokens(lockAmount);
      }

      const [amounts] = await lockContract.getUserLocks(user1.address);
      expect(amounts.length).to.equal(numLocks);
      expect(await lockContract.totalLocked()).to.equal(lockAmount * BigInt(numLocks));

      await time.increase(365 * 24 * 60 * 60);

      await lockContract.connect(user1).claimAllUnlocked();
      expect(await lockContract.totalLocked()).to.equal(0);
    });

    it("Should emit correct events", async function () {
      const { lockContract, ecmToken, user1 } = await loadFixture(deployFixture);

      const lockAmount = ethers.parseEther("1000");
      await ecmToken.connect(user1).approve(await lockContract.getAddress(), lockAmount);

      const block = await ethers.provider.getBlock("latest");
      const expectedReleaseTime = BigInt(block!.timestamp + 1) + BigInt(365 * 24 * 60 * 60);

      await expect(lockContract.connect(user1).lockTokens(lockAmount))
        .to.emit(lockContract, "TokensLocked")
        .withArgs(user1.address, lockAmount, expectedReleaseTime, 0);

      await time.increase(365 * 24 * 60 * 60);

      await expect(lockContract.connect(user1).claimAllUnlocked())
        .to.emit(lockContract, "Claim")
        .withArgs(user1.address, lockAmount, 0);
    });
  });
});
