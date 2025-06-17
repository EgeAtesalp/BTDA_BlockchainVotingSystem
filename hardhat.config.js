require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: "0.8.19",
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    hardhat: {
      mining: {
        auto: false,
        interval: 1000 // 1 second block time for realistic simulation
      }
    }
  }
};