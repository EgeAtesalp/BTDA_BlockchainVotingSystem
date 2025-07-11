require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: "0.8.19",
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    hardhat: {
      accounts: { count : 3001},
      blockGasLimit: 50000000,
      // Increase timeout for network operations
      timeout: 900000, // 15 minutes,
      gas: "auto",
      mining: {
        auto: false,
        interval: 1000 // 1 second block time for realistic simulation
      }
    }
  },
  mocha: {
    timeout: 300000, // 5 minutes - matches the test timeout
    reporter: 'spec',
    slow: 30000, // Consider tests slow if >30s
  }
};

require("@nomicfoundation/hardhat-toolbox");
