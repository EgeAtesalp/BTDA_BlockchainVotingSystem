// hardhat.config.js - Corrected configuration for large-scale testing
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
    solidity: {
        version: "0.8.19",
        settings: {
            optimizer: {
                enabled: true,
                runs: 1000,
            },
        },
    },
    networks: {
        hardhat: {
            // Optimized for large-scale testing with massive funding
            accounts: {
                count: 20, // Keep default accounts small, we'll generate millions separately
                mnemonic: "test test test test test test test test test test test junk",
                accountsBalance: "500000000000000000000000", // 500,000 ETH per default account for funding
            },
            blockGasLimit: 300000000, // 300M gas limit
            gasPrice: 1000000000, // 1 gwei
            allowUnlimitedContractSize: true,
            mining: {
                auto: true,
                interval: 0, // Mine immediately
            },
        },
        localhost: {
            url: "http://127.0.0.1:8545",
            timeout: 60000,
        },
    },
    mocha: {
        timeout: 1800000, // 30 minutes timeout for large tests
    },
    gasReporter: {
        enabled: false, // Disable for performance tests
    },
};