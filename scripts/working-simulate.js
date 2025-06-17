// scripts/working-simulate.js
const { ethers } = require("hardhat");

class VirtualAgent {
  constructor(address, districtId, preferences, strategy = "honest") {
    this.address = address;
    this.districtId = districtId;
    this.preferences = preferences;
    this.strategy = strategy;
  }
  
  generateScores(candidateCount) {
    switch (this.strategy) {
      case "honest":
        return this.preferences;
      case "strategic":
        const maxIndex = this.preferences.indexOf(Math.max(...this.preferences));
        return this.preferences.map((score, index) => 
          index === maxIndex ? 10 : Math.max(0, score - 3)
        );
      case "polarized":
        return this.preferences.map(score => score > 5 ? 10 : 0);
      case "random":
        return Array(candidateCount).fill(0).map(() => Math.floor(Math.random() * 11));
      default:
        return this.preferences;
    }
  }
}

async function workingSimulation() {
  console.log("🗳️  Starting Working Election Simulation...");
  console.log("=" .repeat(50));
  
  try {
    // Get signers
    const signers = await ethers.getSigners();
    const admin = signers[0];
    
    console.log("👤 Admin:", admin.address);
    
    // Deploy contract
    console.log("\n📄 Deploying Election Contract...");
    const ScoreVotingElection = await ethers.getContractFactory("ScoreVotingElection");
    const election = await ScoreVotingElection.deploy();
    await election.waitForDeployment();
    
    const contractAddress = await election.getAddress();
    console.log("✅ Contract deployed to:", contractAddress);
    
    // Check initial state
    console.log("\n🔍 Initial State Check:");
    console.log("  District count:", (await election.districtCount()).toString());
    console.log("  Candidate count:", (await election.candidateCount()).toString());
    console.log("  Voter count:", (await election.totalRegisteredVoters()).toString());
    console.log("  Election state:", (await election.state()).toString());
    
    // Create districts one by one with verification
    console.log("\n🏛️  Creating Districts...");
    const districtNames = ["California", "Texas", "New York"];
    
    for (let i = 0; i < districtNames.length; i++) {
      console.log(`  Creating district ${i}: ${districtNames[i]}...`);
      const tx = await election.createDistrict(districtNames[i]);
      await tx.wait();
      
      const count = await election.districtCount();
      console.log(`    District count after creation: ${count}`);
      
      if (count.toString() !== (i + 1).toString()) {
        throw new Error(`District count mismatch! Expected ${i + 1}, got ${count}`);
      }
    }
    
    const finalDistrictCount = await election.districtCount();
    console.log(`✅ Successfully created ${finalDistrictCount} districts`);
    
    // Add candidates one by one with verification
    console.log("\n🏃 Adding Candidates...");
    const candidates = [
      { name: "Alice Progressive", party: "Progressive" },
      { name: "Bob Conservative", party: "Conservative" },
      { name: "Carol Moderate", party: "Moderate" }
    ];
    
    for (let i = 0; i < candidates.length; i++) {
      console.log(`  Adding candidate ${i}: ${candidates[i].name}...`);
      const tx = await election.addCandidate(candidates[i].name, candidates[i].party);
      await tx.wait();
      
      const count = await election.candidateCount();
      console.log(`    Candidate count after addition: ${count}`);
      
      if (count.toString() !== (i + 1).toString()) {
        throw new Error(`Candidate count mismatch! Expected ${i + 1}, got ${count}`);
      }
    }
    
    const finalCandidateCount = await election.candidateCount();
    console.log(`✅ Successfully added ${finalCandidateCount} candidates`);
    
    // Register voters with verification
    console.log("\n🤖 Registering Virtual Voters...");
    const agents = [];
    const voterSigners = signers.slice(1, 11); // Use 10 voters
    
    for (let i = 0; i < voterSigners.length; i++) {
      const districtId = i % districtNames.length;
      
      // Generate voter preferences
      let preferences;
      const voterType = Math.random();
      
      if (voterType < 0.33) {
        preferences = [9, 2, 5]; // Progressive voter
      } else if (voterType < 0.66) {
        preferences = [3, 9, 6]; // Conservative voter  
      } else {
        preferences = [5, 5, 9]; // Moderate voter
      }
      
      const strategy = Math.random() < 0.8 ? "honest" : "strategic";
      
      const agent = new VirtualAgent(
        voterSigners[i].address,
        districtId,
        preferences,
        strategy
      );
      
      agents.push(agent);
      
      console.log(`  Registering voter ${i + 1} in district ${districtId}...`);
      const tx = await election.registerVoter(agent.address, agent.districtId);
      await tx.wait();
      
      const voterCount = await election.totalRegisteredVoters();
      console.log(`    Total registered voters: ${voterCount}`);
      
      if (voterCount.toString() !== (i + 1).toString()) {
        throw new Error(`Voter count mismatch! Expected ${i + 1}, got ${voterCount}`);
      }
    }
    
    const finalVoterCount = await election.totalRegisteredVoters();
    console.log(`✅ Successfully registered ${finalVoterCount} voters`);
    
    // Start voting with verification
    console.log("\n🗳️  Starting Voting Phase...");
    const startTx = await election.startVoting();
    await startTx.wait();
    
    const votingState = await election.state();
    console.log(`✅ Election state after start: ${votingState} (should be 1)`);
    
    if (votingState.toString() !== "1") {
      throw new Error(`Election not in voting state! Expected 1, got ${votingState}`);
    }
    
    // Cast votes with verification
    console.log("\n📝 Casting Votes...");
    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      const scores = agent.generateScores(candidates.length);
      
      console.log(`  Voter ${i + 1} voting with scores: [${scores.join(', ')}]...`);
      
      const voterContract = election.connect(voterSigners[i]);
      const voteTx = await voterContract.castVote(scores);
      await voteTx.wait();
      
      const totalVotes = await election.totalVotes();
      console.log(`    Total votes cast: ${totalVotes}`);
      
      if (totalVotes.toString() !== (i + 1).toString()) {
        throw new Error(`Vote count mismatch! Expected ${i + 1}, got ${totalVotes}`);
      }
    }
    
    const finalVoteCount = await election.totalVotes();
    console.log(`✅ Successfully cast ${finalVoteCount} votes`);
    
    // End election
    console.log("\n🏁 Ending Election...");
    const endTx = await election.endElection();
    await endTx.wait();
    
    const finalState = await election.state();
    console.log(`✅ Final election state: ${finalState} (should be 2)`);
    
    if (finalState.toString() !== "2") {
      throw new Error(`Election not properly ended! Expected 2, got ${finalState}`);
    }
    
    // Get and display results
    console.log("\n🏆 ELECTION RESULTS");
    console.log("=" .repeat(50));
    
    const results = await election.getResults();
    
    for (let i = 0; i < candidates.length; i++) {
      const totalScore = parseInt(results[1][i].toString());
      const voteCount = parseInt(results[2][i].toString());
      const avgScore = voteCount > 0 ? (totalScore / voteCount).toFixed(2) : "0.00";
      
      console.log(`${candidates[i].name} (${candidates[i].party}):`);
      console.log(`  Total Score: ${totalScore}`);
      console.log(`  Votes Received: ${voteCount}/${agents.length}`);
      console.log(`  Average Score: ${avgScore}`);
      console.log("");
    }
    
    // Overall statistics
    console.log("📈 SIMULATION SUMMARY");
    console.log("=" .repeat(30));
    console.log(`Districts: ${finalDistrictCount}`);
    console.log(`Candidates: ${finalCandidateCount}`);
    console.log(`Registered Voters: ${finalVoterCount}`);
    console.log(`Votes Cast: ${finalVoteCount}`);
    console.log(`Turnout: ${(Number(finalVoteCount) * 100 / Number(finalVoterCount)).toFixed(1)}%`);
    
    console.log("\n🎉 SIMULATION COMPLETED SUCCESSFULLY!");
    console.log("✅ Score voting system working perfectly");
    console.log("✅ Country-wide election simulation complete");
    
    return {
      districts: Number(finalDistrictCount),
      candidates: Number(finalCandidateCount), 
      voters: Number(finalVoterCount),
      votes: Number(finalVoteCount)
    };
    
  } catch (error) {
    console.error("\n❌ SIMULATION ERROR:", error.message);
    throw error;
  }
}

if (require.main === module) {
  workingSimulation()
    .then((results) => {
      console.log("\n📊 Final Results:", results);
      process.exit(0);
    })
    .catch((error) => {
      console.error("Simulation failed:", error);
      process.exit(1);
    });
}

module.exports = { workingSimulation, VirtualAgent };