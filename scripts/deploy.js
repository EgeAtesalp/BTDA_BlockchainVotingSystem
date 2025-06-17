const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying Score Voting Election contract...");
  
  // Get the contract factory
  const ScoreVotingElection = await ethers.getContractFactory("ScoreVotingElection");
  
  // Deploy the contract
  const election = await ScoreVotingElection.deploy();
  await election.waitForDeployment();
  
  const address = await election.getAddress();
  console.log("ScoreVotingElection deployed to:", address);
  
  // Setup initial election data
  console.log("\nSetting up election...");
  
  // Create districts (simulating country-wide election)
  const districts = [
    "California-District-1",
    "Texas-District-2", 
    "New-York-District-3",
    "Florida-District-4",
    "Illinois-District-5"
  ];
  
  for (let i = 0; i < districts.length; i++) {
    await election.createDistrict(districts[i]);
    console.log(`Created district: ${districts[i]}`);
  }
  
  // Add candidates
  const candidates = [
    { name: "Alice Johnson", party: "Progressive Party" },
    { name: "Bob Smith", party: "Conservative Party" },
    { name: "Carol Davis", party: "Moderate Party" },
    { name: "David Wilson", party: "Green Party" }
  ];
  
  for (let candidate of candidates) {
    await election.addCandidate(candidate.name, candidate.party);
    console.log(`Added candidate: ${candidate.name} (${candidate.party})`);
  }
  
  console.log("\nElection setup complete!");
  console.log("Contract address:", address);
  
  return {
    election,
    address
  };
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = main;