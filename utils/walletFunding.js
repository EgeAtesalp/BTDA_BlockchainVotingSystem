// utils/walletFunding.js - Efficient wallet funding for large scales
const { ethers } = require("hardhat");

/**
 * Efficiently fund large numbers of wallets
 */
class WalletFunder {
    constructor(admin, options = {}) {
        this.admin = admin;
        this.fundingAmount = options.fundingAmount || ethers.parseEther("1.0");
        this.batchSize = options.batchSize || 50;
        this.gasLimit = options.gasLimit || 21000;
        this.maxConcurrent = options.maxConcurrent || 10;
    }

    /**
     * Fund wallets in parallel batches
     */
    async fundWallets(wallets) {
        console.log(`Funding ${wallets.length} wallets with ${ethers.formatEther(this.fundingAmount)} ETH each...`);
        
        const startTime = Date.now();
        let successCount = 0;
        let failCount = 0;
        
        // Process in controlled batches
        for (let i = 0; i < wallets.length; i += this.batchSize) {
            const batch = wallets.slice(i, i + this.batchSize);
            
            // Create funding promises for this batch
            const batchPromises = batch.map(async (wallet) => {
                try {
                    const tx = await this.admin.sendTransaction({
                        to: wallet.address,
                        value: this.fundingAmount,
                        gasLimit: this.gasLimit
                    });
                    await tx.wait();
                    return { success: true, address: wallet.address };
                } catch (error) {
                    return { success: false, address: wallet.address, error: error.message };
                }
            });
            
            // Wait for batch to complete
            const results = await Promise.all(batchPromises);
            
            // Count results
            const batchSuccess = results.filter(r => r.success).length;
            const batchFail = results.filter(r => !r.success).length;
            
            successCount += batchSuccess;
            failCount += batchFail;
            
            // Progress reporting
            if (i % (this.batchSize * 4) === 0 || i + this.batchSize >= wallets.length) {
                const progress = Math.min(i + this.batchSize, wallets.length);
                console.log(`   Funding progress: ${progress}/${wallets.length} (${successCount} success, ${failCount} failed)`);
            }
        }
        
        const duration = Date.now() - startTime;
        console.log(`✅ Funding completed in ${duration}ms: ${successCount} success, ${failCount} failed`);
        
        return { successCount, failCount, duration };
    }

    /**
     * Verify wallet balances
     */
    async verifyBalances(wallets, sampleSize = 5) {
        console.log(`Verifying balances for ${Math.min(sampleSize, wallets.length)} wallets...`);
        
        const samplesToCheck = wallets.slice(0, Math.min(sampleSize, wallets.length));
        
        for (let i = 0; i < samplesToCheck.length; i++) {
            const wallet = samplesToCheck[i];
            try {
                const balance = await ethers.provider.getBalance(wallet.address);
                console.log(`   Wallet ${i}: ${ethers.formatEther(balance)} ETH`);
                
                if (balance < ethers.parseEther("0.1")) {
                    console.log(`   ⚠️ Wallet ${i} has low balance!`);
                }
            } catch (error) {
                console.log(`   ❌ Error checking wallet ${i}: ${error.message}`);
            }
        }
    }

    /**
     * Get admin balance and estimate funding capacity
     */
    async checkFundingCapacity(numWallets) {
        const adminBalance = await ethers.provider.getBalance(this.admin.address);
        const totalNeeded = this.fundingAmount * BigInt(numWallets);
        const gasEstimate = ethers.parseEther("0.01") * BigInt(numWallets); // Rough gas estimate
        const totalCost = totalNeeded + gasEstimate;
        
        console.log(`💰 Admin balance: ${ethers.formatEther(adminBalance)} ETH`);
        console.log(`💸 Funding needed: ${ethers.formatEther(totalNeeded)} ETH`);
        console.log(`⛽ Gas estimate: ${ethers.formatEther(gasEstimate)} ETH`);
        console.log(`💵 Total cost: ${ethers.formatEther(totalCost)} ETH`);
        
        const sufficient = adminBalance >= totalCost;
        console.log(`${sufficient ? '✅' : '❌'} Funding capacity: ${sufficient ? 'Sufficient' : 'Insufficient'}`);
        
        return {
            adminBalance,
            totalNeeded,
            gasEstimate,
            totalCost,
            sufficient
        };
    }
}

module.exports = WalletFunder;