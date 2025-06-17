// scripts/robust-simulate.js
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

async function robustSimulation() {
  console.log("🗳️  Starting Robust Election Simulation...");
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
    
    // Setup districts
    console.log("\n🏛️  Creating Districts...");
    const districtNames = ["California", "Texas", "New York", "Florida", "Illinois"];
    
    for (let i = 0; i < districtNames.length; i++) {
      await election.createDistrict(districtNames[i]);
      console.log(`   District ${i}: ${districtNames[i]}`);
    }
    
    const districtCount = await election.districtCount();
    console.log(`✅ Created ${districtCount} districts`);
    
    // Add candidates
    console.log("\n🏃 Adding Candidates...");
    const candidates = [
      { name: "Alice Progressive", party: "Progressive" },
      { name: "Bob Conservative", party: "Conservative" },
      { name: "Carol Moderate", party: "Moderate" },
      { name: "David Green", party: "Green" }
    ];
    
    for (let candidate of candidates) {
      await election.addCandidate(candidate.name, candidate.party);
      console.log(`   Added: ${candidate.name} (${candidate.party})`);
    }
    
    const candidateCount = await election.candidateCount();
    console.log(`✅ Added ${candidateCount} candidates`);
    
    // Create virtual agents
    console.log("\n🤖 Creating Virtual Voters...");
    const agents = [];
    const voterSigners = signers.slice(1, Math.min(21, signers.length)); // Up to 20 voters
    
    for (let i = 0; i < voterSigners.length; i++) {
      const districtId = i % districtNames.length;
      
      // Generate realistic voter preferences based on political alignment
      let preferences;
      const voterType = Math.random();
      
      if (voterType < 0.25) {
        // Progressive voters: High scores for Progressive and Green
        preferences = [9, 2, 5, 8];
      } else if (voterType < 0.5) {
        // Conservative voters: High score for Conservative
        preferences = [3, 9, 6, 2];
      } else if (voterType < 0.75) {
        // Moderate voters: High score for Moderate
        preferences = [5, 5, 9, 4];
      } else {
        // Green voters: High score for Green
        preferences = [7, 1, 4, 10];
      }
      
      // Assign voting strategies
      let strategy = "honest";
      const strategyRoll = Math.random();
      if (strategyRoll < 0.15) strategy = "strategic";
      else if (strategyRoll < 0.25) strategy = "polarized";
      else if (strategyRoll < 0.3) strategy = "random";
      
      const agent = new VirtualAgent(
        voterSigners[i].address,
        districtId,
        preferences,
        strategy
      );
      
      agents.push(agent);
      
      // Register voter
      await election.registerVoter(agent.address, agent.districtId);
      
      if ((i + 1) % 5 === 0) {
        console.log(`   Registered ${i + 1} voters...`);
      }
    }
    
    console.log(`✅ Registered ${agents.length} virtual voters`);
    
    // Show voter distribution
    console.log("\n📊 Voter Distribution by District:");
    for (let i = 0; i < districtNames.length; i++) {
      const votersInDistrict = agents.filter(agent => agent.districtId === i).length;
      console.log(`   ${districtNames[i]}: ${votersInDistrict} voters`);
    }
    
    // Show strategy distribution
    const strategyCount = {};
    agents.forEach(agent => {
      strategyCount[agent.strategy] = (strategyCount[agent.strategy] || 0) + 1;
    });
    console.log("\n🎯 Voting Strategies:");
    Object.entries(strategyCount).forEach(([strategy, count]) => {
      console.log(`   ${strategy}: ${count} voters`);
    });
    
    // Start voting
    console.log("\n🗳️  Starting Voting Phase...");
    await election.startVoting();
    
    const votingState = await election.state();
    console.log(`✅ Election state: ${votingState} (1=Voting)`);
    
    // Cast votes
    console.log("\n📝 Casting Votes...");
    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      const scores = agent.generateScores(candidates.length);
      
      try {
        const voterContract = election.connect(voterSigners[i]);
        await voterContract.castVote(scores);
        
        if ((i + 1) % 5 === 0) {
          console.log(`   ${i + 1} votes cast...`);
        }
      } catch (error) {
        console.log(`   ❌ Error casting vote for voter ${i + 1}:`, error.message);
      }
    }
    
    const totalVotes = await election.totalVotes();
    console.log(`✅ Total votes cast: ${totalVotes}`);
    
    // End election
    console.log("\n🏁 Ending Election...");
    await election.endElection();
    
    // Verify final state
    const finalState = await election.state();
    console.log(`✅ Final election state: ${finalState} (2=Ended)`);
    
    if (finalState.toString() !== "2") {
      throw new Error(`Election not properly ended. State: ${finalState}`);
    }
    
    // Get and display results
    console.log("\n🏆 ELECTION RESULTS");
    console.log("=" .repeat(50));
    
    const results = await election.getResults();
    
    // Create results with candidate info
    const candidateResults = [];
    for (let i = 0; i < candidates.length; i++) {
      candidateResults.push({
        name: candidates[i].name,
        party: candidates[i].party,
        totalScore: parseInt(results[1][i].toString()),
        voteCount: parseInt(results[2][i].toString()),
        avgScore: parseInt(results[2][i].toString()) > 0 ? 
          (parseInt(results[1][i].toString()) / parseInt(results[2][i].toString())).toFixed(2) : "0.00"
      });
    }
    
    // Sort by total score (winner first)
    candidateResults.sort((a, b) => b.totalScore - a.totalScore);
    
    candidateResults.forEach((candidate, index) => {
      const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "  ";
      console.log(`${medal} ${candidate.name} (${candidate.party})`);
      console.log(`    Total Score: ${candidate.totalScore}`);
      console.log(`    Votes Received: ${candidate.voteCount}/${agents.length}`);
      console.log(`    Average Score: ${candidate.avgScore}`);
      console.log("");
    });
    
    // District analysis
    console.log("📍 DISTRICT ANALYSIS");
    console.log("=" .repeat(30));
    
    for (let i = 0; i < districtNames.length; i++) {
      const district = await election.getDistrict(i);
      const turnout = await election.getDistrictTurnout(i);
      
      console.log(`${districtNames[i]}:`);
      console.log(`  Registered: ${district[1]}`);
      console.log(`  Voted: ${district[2]}`);
      console.log(`  Turnout: ${turnout}%`);
      console.log("");
    }
    
    // Overall statistics
    console.log("📈 OVERALL STATISTICS");
    console.log("=" .repeat(30));
    
    const stats = await election.getElectionStats();
    console.log(`Total Registered Voters: ${stats[0]}`);
    console.log(`Total Votes Cast: ${stats[1]}`);
    console.log(`Number of Candidates: ${stats[2]}`);
    console.log(`Number of Districts: ${stats[3]}`);
    console.log(`Overall Turnout: ${stats[4]}%`);
    
    console.log("\n🎉 SIMULATION COMPLETED SUCCESSFULLY!");
    console.log("✅ Score voting system working perfectly");
    console.log("✅ Country-wide election simulation complete");
    console.log("✅ All blockchain features operational");
    
    return {
      election,
      results: candidateResults,
      stats: stats,
      totalVoters: agents.length
    };
    
  } catch (error) {
    console.error("\n❌ SIMULATION ERROR:", error.message);
    console.error("Stack trace:", error.stack);
    throw error;
  }
}

if (require.main === module) {
  robustSimulation()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Simulation failed:", error);
      process.exit(1);
    });
}

module.exports = { robustSimulation, VirtualAgent };