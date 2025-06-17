// test/single.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Single Test - Complete Workflow", function () {
  
  it("Should complete entire election workflow in one test", async function () {
    const [admin, voter1, voter2] = await ethers.getSigners();
    
    console.log("=== COMPLETE ELECTION WORKFLOW ===");
    console.log("Admin:", admin.address);
    console.log("Voters:", [voter1.address, voter2.address]);
    
    // Deploy contract
    const ScoreVotingElection = await ethers.getContractFactory("ScoreVotingElection");
    const election = await ScoreVotingElection.deploy();
    await election.waitForDeployment();
    
    console.log("Contract deployed to:", await election.getAddress());
    
    // Step 1: Initial state
    console.log("\n--- Step 1: Initial State ---");
    console.log("Initial district count:", (await election.districtCount()).toString());
    console.log("Initial candidate count:", (await election.candidateCount()).toString());
    console.log("Initial voter count:", (await election.totalRegisteredVoters()).toString());
    console.log("Initial state:", (await election.state()).toString());
    
    // Step 2: Create district
    console.log("\n--- Step 2: Create District ---");
    const districtTx = await election.createDistrict("California");
    await districtTx.wait();
    console.log("District transaction completed");
    
    const districtCount = await election.districtCount();
    console.log("District count after creation:", districtCount.toString());
    expect(districtCount).to.equal(1);
    
    const district = await election.getDistrict(0);
    console.log("District 0 details:", district);
    
    // Step 3: Add candidates
    console.log("\n--- Step 3: Add Candidates ---");
    const aliceTx = await election.addCandidate("Alice", "Progressive");
    await aliceTx.wait();
    console.log("Alice added");
    
    const bobTx = await election.addCandidate("Bob", "Conservative");
    await bobTx.wait();
    console.log("Bob added");
    
    const candidateCount = await election.candidateCount();
    console.log("Candidate count after additions:", candidateCount.toString());
    expect(candidateCount).to.equal(2);
    
    const alice = await election.getCandidate(0);
    const bob = await election.getCandidate(1);
    console.log("Alice details:", alice);
    console.log("Bob details:", bob);
    
    // Step 4: Register voters
    console.log("\n--- Step 4: Register Voters ---");
    const voter1Tx = await election.registerVoter(voter1.address, 0);
    await voter1Tx.wait();
    console.log("Voter 1 registered");
    
    const voter2Tx = await election.registerVoter(voter2.address, 0);
    await voter2Tx.wait();
    console.log("Voter 2 registered");
    
    const voterCount = await election.totalRegisteredVoters();
    console.log("Total registered voters:", voterCount.toString());
    expect(voterCount).to.equal(2);
    
    const voter1Details = await election.voters(voter1.address);
    console.log("Voter 1 details:", voter1Details);
    
    // Step 5: Start voting
    console.log("\n--- Step 5: Start Voting ---");
    const startTx = await election.startVoting();
    await startTx.wait();
    console.log("Voting started");
    
    const electionState = await election.state();
    console.log("Election state after start:", electionState.toString());
    expect(electionState).to.equal(1); // Voting state
    
    // Step 6: Cast votes
    console.log("\n--- Step 6: Cast Votes ---");
    
    // Voter 1: Alice=10, Bob=5
    const vote1Tx = await election.connect(voter1).castVote([10, 5]);
    await vote1Tx.wait();
    console.log("Voter 1 voted: Alice=10, Bob=5");
    
    // Voter 2: Alice=8, Bob=7
    const vote2Tx = await election.connect(voter2).castVote([8, 7]);
    await vote2Tx.wait();
    console.log("Voter 2 voted: Alice=8, Bob=7");
    
    const totalVotes = await election.totalVotes();
    console.log("Total votes cast:", totalVotes.toString());
    expect(totalVotes).to.equal(2);
    
    // Check candidate scores after voting
    const aliceAfterVoting = await election.getCandidate(0);
    const bobAfterVoting = await election.getCandidate(1);
    console.log("Alice after voting:", aliceAfterVoting);
    console.log("Bob after voting:", bobAfterVoting);
    
    expect(aliceAfterVoting[3]).to.equal(18); // Alice: 10+8=18
    expect(bobAfterVoting[3]).to.equal(12);   // Bob: 5+7=12
    
    // Step 7: End election
    console.log("\n--- Step 7: End Election ---");
    const endTx = await election.endElection();
    await endTx.wait();
    console.log("Election ended");
    
    const finalState = await election.state();
    console.log("Final election state:", finalState.toString());
    expect(finalState).to.equal(2); // Ended state
    
    // Step 8: Get results
    console.log("\n--- Step 8: Get Results ---");
    const results = await election.getResults();
    console.log("Final results:");
    console.log("  Candidate IDs:", results[0].map(id => id.toString()));
    console.log("  Total Scores:", results[1].map(score => score.toString()));
    console.log("  Vote Counts:", results[2].map(count => count.toString()));
    
    expect(results[1][0]).to.equal(18); // Alice total score
    expect(results[1][1]).to.equal(12); // Bob total score
    expect(results[2][0]).to.equal(2);  // Alice vote count
    expect(results[2][1]).to.equal(2);  // Bob vote count
    
    // Step 9: Get statistics
    console.log("\n--- Step 9: Final Statistics ---");
    const stats = await election.getElectionStats();
    console.log("Election statistics:");
    console.log("  Total registered voters:", stats[0].toString());
    console.log("  Total votes cast:", stats[1].toString());
    console.log("  Number of candidates:", stats[2].toString());
    console.log("  Number of districts:", stats[3].toString());
    console.log("  Turnout percentage:", stats[4].toString() + "%");
    
    expect(stats[0]).to.equal(2);   // 2 registered voters
    expect(stats[1]).to.equal(2);   // 2 votes cast
    expect(stats[2]).to.equal(2);   // 2 candidates
    expect(stats[3]).to.equal(1);   // 1 district
    expect(stats[4]).to.equal(100); // 100% turnout
    
    console.log("\n🎉 COMPLETE ELECTION WORKFLOW SUCCESSFUL! 🎉");
    console.log("✅ Score voting system working perfectly");
    console.log("✅ District-based voting implemented");
    console.log("✅ Country-wide election simulation complete");
  });
});