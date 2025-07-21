// utils/scalableSigners.js - Drop-in replacement for ethers.getSigners()
const { ethers } = require("hardhat");
const BatchWalletGenerator = require('./batchWalletGenerator');

/**
 * Drop-in replacement for ethers.getSigners() that can handle millions of signers
 * @param {number} count - Number of signers to generate (default: 20 like Hardhat default)
 * @param {boolean} useCache - Whether to use cached wallets (default: true)
 * @returns {Promise<Array>} Array of ethers Wallet instances
 */
async function getScalableSigners(count = 20, useCache = true) {
    // For small counts, use regular ethers.getSigners() for compatibility
    if (count <= 1000) {
        const signers = await ethers.getSigners();
        if (signers.length >= count) {
            return signers.slice(0, count);
        }
    }

    // For large counts, use BatchWalletGenerator
    const generator = new BatchWalletGenerator({
        cacheDir: './cache/signers'
    });

    const wallets = await generator.generateWallets(count, !useCache);
    const provider = ethers.provider;

    return generator.getSigners(provider);
}

/**
 * Get signers for specific use cases
 */
class ScalableSignerManager {
    constructor() {
        this.generator = new BatchWalletGenerator({
            cacheDir: './cache/signers'
        });
        this.cachedSigners = new Map();
    }

    /**
     * Get signers for testing (cached by default)
     */
    async getTestSigners(count) {
        if (this.cachedSigners.has(count)) {
            return this.cachedSigners.get(count);
        }

        const wallets = await this.generator.generateWallets(count);
        const signers = this.generator.getSigners(ethers.provider);
        
        this.cachedSigners.set(count, signers);
        return signers;
    }

    /**
     * Get voter wallets for election simulation
     */
    async getVoterWallets(count) {
        const wallets = await this.generator.generateWallets(count);
        return wallets; // Return raw wallet data with addresses, private keys, etc.
    }

    /**
     * Get addresses only (for registration without full wallet objects)
     */
    async getVoterAddresses(count) {
        const wallets = await this.generator.generateWallets(count);
        return this.generator.getAddresses();
    }

    /**
     * Clear cache for memory management
     */
    clearCache() {
        this.cachedSigners.clear();
        this.generator.clearCache();
    }

    /**
     * Get memory usage statistics
     */
    getMemoryUsage() {
        return this.generator.getMemoryUsage();
    }
}

// Export both functional and class-based approaches
module.exports = {
    getScalableSigners,
    ScalableSignerManager,
    BatchWalletGenerator
};

// Example usage in your existing code:
/*
// OLD CODE:
// const signers = await ethers.getSigners();

// NEW CODE (drop-in replacement):
const { getScalableSigners } = require('./utils/scalableSigners');
const signers = await getScalableSigners(1000000); // 1M signers

// OR for more control:
const { ScalableSignerManager } = require('./utils/scalableSigners');
const signerManager = new ScalableSignerManager();
const voters = await signerManager.getVoterWallets(1000000);
const addresses = await signerManager.getVoterAddresses(1000000);
*/