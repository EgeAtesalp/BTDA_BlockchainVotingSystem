const { ethers } = require("hardhat");

class VirtualAgent {
  constructor(address, districtId, preferences, strategy = "honest") {
    this.address = address;
    this.districtId = districtId;
    this.preferences = preferences; // Array of preferred scores for each candidate
    this.strategy = strategy;
  }
  
  // Generate scores based on agent's strategy
  generateScores(candidates) {
    switch (this.strategy) {
      case "honest":
        return this.preferences;
      
      case "strategic":
        // Strategic voting: give max score to favorite, min to others
        const maxIndex = this.preferences.indexOf(Math.max(...this.preferences));
        return this.preferences.map((score, index) => 
          index === maxIndex ? 10 : Math.max(0, score - 3)
        );
      
      case "polarized":
        // Polarized voting: only extreme scores (0 or 10)
        return this.preferences.map(score => score > 5 ? 10 : 0);
      
      case "random":
        // Random scores within reasonable range
        return Array(candidates).fill(0).map(() => Math.floor(Math.random() * 11));
      
      default:
        return this.preferences;
    }
  }
}

async function simulateElection() {
  console.log("Starting election simulation...");
  
  // Get signers (virtual voters)
  const signers = await ethers.getSigners();
  const admin = signers[0];
  
  // Deploy election contract
  const ScoreVotingElection = await ethers.getContractFactory("ScoreVotingElection");
  const election = await ScoreVotingElection.deploy();
  await election.waitForDeployment();
  
  console.log("Election contract deployed:", await election.getAddress());
  
  // Setup districts
  const districtNames = ["California", "Texas", "New York", "Florida", "Illinois"];
  for (let name of districtNames) {
    await election.createDistrict(name);
  }
  
  // Add candidates
  const candidates = [
    { name: "Alice Progressive", party: "Progressive" },
    { name: "Bob Conservative", party: "Conservative" },
    { name: "Carol Moderate", party: "Moderate" },
    { name: "David Green", party: "Green" }
  ];
  
  for (let candidate of candidates) {
    await election.addCandidate(candidate.name, candidate.party);
  }
  
  // Create virtual agents with different preferences
  const agents = [];
  const voterSigners = signers.slice(1, Math.min(101, signers.length)); // Use up to 100 voters
  
  for (let i = 0; i < voterSigners.length; i++) {
    const districtId = i % 5; // Distribute across 5 districts
    
    // Generate realistic voter preferences
    let preferences;
    const voterType = Math.random();
    
    if (voterType < 0.3) {
      // Progressive voters
      preferences = [9, 2, 5, 7]; // High scores for Progressive and Green
    } else if (voterType < 0.6) {
      // Conservative voters  
      preferences = [3, 9, 6, 2]; // High score for Conservative
    } else if (voterType < 0.8) {
      // Moderate voters
      preferences = [5, 5, 8, 4]; // High score for Moderate
    } else {
      // Green voters
      preferences = [6, 1, 4, 10]; // High score for Green
    }
    
    // Assign voting strategies
    let strategy = "honest";
    if (Math.random() < 0.2) strategy = "strategic";
    else if (Math.random() < 0.1) strategy = "polarized";
    else if (Math.random() < 0.05) strategy = "random";
    
    const agent = new VirtualAgent(
      voterSigners[i].address,
      districtId,
      preferences,
      strategy
    );
    
    agents.push(agent);
    
    // Register voter
    await election.registerVoter(agent.address, agent.districtId);
  }
  
  console.log(`Registered ${agents.length} virtual voters across ${districtNames.length} districts`);
  
  // Start voting
  await election.startVoting();
  console.log("Voting phase started");
  
  // Simulate voting process
  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];
    const scores = agent.generateScores(candidates.length);
    
    // Connect as the voter and cast vote
    const voterContract = election.connect(voterSigners[i]);
    await voterContract.castVote(scores);
    
    if ((i + 1) % 20 === 0) {
      console.log(`${i + 1} votes cast...`);
    }
  }
  
  console.log("All votes cast!");
  
  // End election
  await election.endElection();
  console.log("Election ended");
  
  // Wait a moment for state to update
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Check final state before getting results
  const finalState = await election.state();
  console.log("Final election state:", finalState.toString());
  
  if (finalState.toString() !== "2") {
    console.log("WARNING: Election not in Ended state. Current state:", finalState.toString());
    console.log("States: 0=Registration, 1=Voting, 2=Ended");
    return;
  }
  
  // Display results
  const results = await election.getResults();
  console.log("\n=== ELECTION RESULTS ===");
  
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const totalScore = results[1][i];
    const voteCount = results[2][i];
    const avgScore = voteCount > 0 ? (totalScore / voteCount).toFixed(2) : "0.00";
    
    console.log(`${candidate.name} (${candidate.party}):`);
    console.log(`  Total Score: ${totalScore}`);
    console.log(`  Vote Count: ${voteCount}`);
    console.log(`  Average Score: ${avgScore}`);
    console.log("");
  }
  
  // District analysis
  console.log("=== DISTRICT TURNOUT ===");
  for (let i = 0; i < districtNames.length; i++) {
    const turnout = await election.getDistrictTurnout(i);
    const district = await election.getDistrict(i);
    console.log(`${district[0]}: ${district[2]}/${district[1]} votes (${turnout}%)`);
  }
  
  // Overall stats
  const stats = await election.getElectionStats();
  console.log("\n=== OVERALL STATISTICS ===");
  console.log(`Total Registered Voters: ${stats[0]}`);
  console.log(`Total Votes Cast: ${stats[1]}`);
  console.log(`Number of Candidates: ${stats[2]}`);
  console.log(`Number of Districts: ${stats[3]}`);
  console.log(`Overall Turnout: ${stats[4]}%`);
  
  return {
    election,
    results,
    agents,
    stats
  };
}

if (require.main === module) {
  simulateElection()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { simulateElection, VirtualAgent };
