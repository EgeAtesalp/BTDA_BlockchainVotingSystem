// utils/batchWalletGenerator.js
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Standalone batch wallet generator for scaling to millions of voters
 * Integrates with existing Hardhat project structure
 */
class BatchWalletGenerator {
    constructor(options = {}) {
        this.numWorkers = options.numWorkers || Math.min(os.cpus().length, 8);
        this.cacheDir = options.cacheDir || './cache/wallets';
        this.batchSize = options.batchSize || 1000;
        this.wallets = [];
        
        // Ensure cache directory exists
        this.ensureCacheDir();
    }

    ensureCacheDir() {
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
    }

    getCacheFilename(count) {
        return path.join(this.cacheDir, `wallets_${count}.json`);
    }

    /**
     * Main function to generate wallets with caching
     * @param {number} count - Number of wallets to generate
     * @param {boolean} forceRegenerate - Force regeneration even if cache exists
     * @returns {Promise<Array>} Array of wallet objects
     */
    async generateWallets(count, forceRegenerate = false) {
        const cacheFile = this.getCacheFilename(count);
        
        // Try to load from cache first
        if (!forceRegenerate && fs.existsSync(cacheFile)) {
            console.log(`Loading ${count} wallets from cache...`);
            return this.loadFromCache(cacheFile);
        }

        console.log(`Generating ${count} new wallets using ${this.numWorkers} workers...`);
        const startTime = Date.now();

        // Generate wallets in parallel
        this.wallets = await this.generateWalletsParallel(count);

        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log(`Generated ${count} wallets in ${duration}ms (${Math.round(count / (duration / 1000))} wallets/sec)`);

        // Save to cache
        this.saveToCache(cacheFile);

        return this.wallets;
    }

    /**
     * Generate wallets using parallel workers
     */
    async generateWalletsParallel(totalCount) {
        const walletsPerWorker = Math.ceil(totalCount / this.numWorkers);
        const workers = [];
        
        for (let i = 0; i < this.numWorkers; i++) {
            const startIndex = i * walletsPerWorker;
            const endIndex = Math.min(startIndex + walletsPerWorker, totalCount);
            
            if (startIndex >= totalCount) break;
            
            const worker = new Worker(__filename, {
                workerData: {
                    startIndex,
                    count: endIndex - startIndex,
                    workerId: i,
                    batchSize: this.batchSize
                }
            });
            
            workers.push(this.handleWorker(worker, i));
        }
        
        const results = await Promise.all(workers);
        
        // Flatten and sort wallets by index
        return results.flat().sort((a, b) => a.index - b.index);
    }

    /**
     * Handle individual worker
     */
    handleWorker(worker, workerId) {
        return new Promise((resolve, reject) => {
            const wallets = [];
            
            worker.on('message', (data) => {
                if (data.type === 'wallet') {
                    wallets.push(data.wallet);
                } else if (data.type === 'progress') {
                    process.stdout.write(`\rWorker ${workerId}: ${data.progress}% `);
                } else if (data.type === 'complete') {
                    console.log(`\nWorker ${workerId} completed`);
                    resolve(wallets);
                }
            });
            
            worker.on('error', reject);
            worker.on('exit', (code) => {
                if (code !== 0) {
                    reject(new Error(`Worker ${workerId} stopped with exit code ${code}`));
                }
            });
        });
    }

    /**
     * Save wallets to cache
     */
    saveToCache(filename) {
        const walletData = this.wallets.map(w => ({
            index: w.index,
            address: w.address,
            privateKey: w.privateKey
        }));
        
        fs.writeFileSync(filename, JSON.stringify(walletData, null, 2));
        console.log(`Cached ${walletData.length} wallets to ${filename}`);
    }

    /**
     * Load wallets from cache
     */
    loadFromCache(filename) {
        const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
        this.wallets = data.map(w => ({
            index: w.index,
            address: w.address,
            privateKey: w.privateKey,
            wallet: new ethers.Wallet(w.privateKey)
        }));
        
        console.log(`Loaded ${this.wallets.length} wallets from cache`);
        return this.wallets;
    }

    /**
     * Get wallets compatible with ethers.getSigners() format
     */
    getSigners(provider = null) {
        return this.wallets.map(w => {
            if (provider) {
                return w.wallet.connect(provider);
            }
            return w.wallet;
        });
    }

    /**
     * Get wallet addresses only
     */
    getAddresses() {
        return this.wallets.map(w => w.address);
    }

    /**
     * Get specific wallet by index
     */
    getWallet(index) {
        return this.wallets.find(w => w.index === index);
    }

    /**
     * Clear cache for specific count
     */
    clearCache(count = null) {
        if (count) {
            const cacheFile = this.getCacheFilename(count);
            if (fs.existsSync(cacheFile)) {
                fs.unlinkSync(cacheFile);
                console.log(`Cleared cache for ${count} wallets`);
            }
        } else {
            // Clear all cache files
            if (fs.existsSync(this.cacheDir)) {
                const files = fs.readdirSync(this.cacheDir);
                files.forEach(file => {
                    if (file.startsWith('wallets_') && file.endsWith('.json')) {
                        fs.unlinkSync(path.join(this.cacheDir, file));
                    }
                });
                console.log('Cleared all wallet cache');
            }
        }
    }

    /**
     * Get memory usage estimate
     */
    getMemoryUsage() {
        const walletSize = 150; // Approximate bytes per wallet object
        const estimatedMemory = this.wallets.length * walletSize;
        
        return {
            walletCount: this.wallets.length,
            estimatedMemoryMB: Math.round(estimatedMemory / 1024 / 1024),
            actualMemoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
        };
    }
}

// Worker thread implementation
if (!isMainThread) {
    const { startIndex, count, workerId, batchSize } = workerData;
    
    async function generateWalletBatch() {
        try {
            for (let i = 0; i < count; i += batchSize) {
                const currentBatchSize = Math.min(batchSize, count - i);
                
                for (let j = 0; j < currentBatchSize; j++) {
                    const wallet = ethers.Wallet.createRandom();
                    
                    parentPort.postMessage({
                        type: 'wallet',
                        wallet: {
                            index: startIndex + i + j,
                            address: wallet.address,
                            privateKey: wallet.privateKey,
                            wallet: wallet
                        }
                    });
                }
                
                // Report progress
                const progress = Math.round(((i + currentBatchSize) / count) * 100);
                parentPort.postMessage({
                    type: 'progress',
                    workerId,
                    progress
                });
            }
            
            parentPort.postMessage({
                type: 'complete',
                workerId
            });
            
        } catch (error) {
            parentPort.postMessage({
                type: 'error',
                error: error.message
            });
        }
    }
    
    generateWalletBatch();
}

module.exports = BatchWalletGenerator;