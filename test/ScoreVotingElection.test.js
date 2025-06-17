// test/working-debug.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Working Debug Test", function () {
  let election;
  let admin;
  let voters;
  
  // Use before() instead of beforeEach() to keep the same contract
  before(async function () {
    [admin, ...voters] = await ethers.getSigners();
    
    console.log("Admin address:", admin.address);
    console.log("Voter addresses:", voters.slice(0, 3).map(v => v.address));
    
    const ScoreVotingElection = await ethers.getContractFactory("ScoreVotingElection");
    election = await ScoreVotingElection.deploy();
    await election.waitForDeployment();
    
    console.log("Contract deployed to:", await election.getAddress());
  });
  
  it("Step 1: Should check initial state", async function () {
    console.log("\n=== STEP 1: Initial State ===");
    console.log("Admin:", await election.admin());
    console.log("State:", await election.state());
    console.log("Candidate Count:", await election.candidateCount());
    console.log("District Count:", await election.districtCount());
    
    expect(await election.candidateCount()).to.equal(0);
    expect(await election.districtCount()).to.equal(0);
  });
  
  it("Step 2: Should create districts", async function () {
    console.log("\n=== STEP 2: Creating Districts ===");
    
    const tx = await election.createDistrict("California");
    await tx.wait();
    
    const districtCount = await election.districtCount();
    console.log("District count after creation:", districtCount);
    
    expect(districtCount).to.equal(1);
    
    if (districtCount > 0) {
      const district = await election.getDistrict(0);
      console.log("District 0:", district);
    }
  });
  
  it("Step 3: Should add candidates", async function () {
    console.log("\n=== STEP 3: Adding Candidates ===");
    
    const tx1 = await election.addCandidate("Alice", "Progressive");
    await tx1.wait();
    
    const tx2 = await election.addCandidate("Bob", "Conservative");
    await tx2.wait();
    
    const candidateCount = await election.candidateCount();
    console.log("Candidate count after additions:", candidateCount);
    
    expect(candidateCount).to.equal(2);
    
    if (candidateCount > 0) {
      const alice = await election.getCandidate(0);
      const bob = await election.getCandidate(1);
      console.log("Alice:", alice);
      console.log("Bob:", bob);
    }
  });
  
  it("Step 4: Should register voters", async function () {
    console.log("\n=== STEP 4: Registering Voters ===");
    
    await election.registerVoter(voters[0].address, 0);
    await election.registerVoter(voters[1].address, 0);
    console.log("Total registered voters:", await election.totalRegisteredVoters());
    
    const voter1 = await election.voters(voters[0].address);
    console.log("Voter 1:", voter1);
    
    expect(await election.totalRegisteredVoters()).to.equal(2);
  });
  
  it("Step 5: Should start voting", async function () {
    console.log("\n=== STEP 5: Starting Voting ===");
    
    await election.startVoting();
    console.log("Election state after start:", await election.state());
    
    expect(await election.state()).to.equal(1); // Voting state
  });
  
  it("Step 6: Should accept votes", async function () {
    console.log("\n=== STEP 6: Casting Votes ===");
    
    // Voter 1: Alice=10, Bob=5
    await election.connect(voters[0]).castVote([10, 5]);
    
    // Voter 2: Alice=8, Bob=7
    await election.connect(voters[1]).castVote([8, 7]);
    
    console.log("Total votes:", await election.totalVotes());
    
    // Check candidate scores
    const alice = await election.getCandidate(0);
    const bob = await election.getCandidate(1);
    console.log("Alice after voting:", alice);
    console.log("Bob after voting:", bob);
    
    expect(await election.totalVotes()).to.equal(2);
    expect(alice[3]).to.equal(18); // Alice total score: 10+8
    expect(bob[3]).to.equal(12);   // Bob total score: 5+7
  });
  
  it("Step 7: Should end election and show results", async function () {
    console.log("\n=== STEP 7: Ending Election ===");
    
    await election.endElection();
    console.log("Final election state:", await election.state());
    
    const results = await election.getResults();
    console.log("Final results:");
    console.log("  Candidate IDs:", results[0].map(id => id.toString()));
    console.log("  Total Scores:", results[1].map(score => score.toString()));
    console.log("  Vote Counts:", results[2].map(count => count.toString()));
    
    expect(await election.state()).to.equal(2); // Ended state
    expect(results[1][0]).to.equal(18); // Alice score
    expect(results[1][1]).to.equal(12); // Bob score
  });
  
  it("Step 8: Should provide statistics", async function () {
    console.log("\n=== STEP 8: Final Statistics ===");
    
    const stats = await election.getElectionStats();
    console.log("Election statistics:");
    console.log("  Total registered voters:", stats[0].toString());
    console.log("  Total votes cast:", stats[1].toString());
    console.log("  Number of candidates:", stats[2].toString());
    console.log("  Number of districts:", stats[3].toString());
    console.log("  Turnout percentage:", stats[4].toString() + "%");
    
    expect(stats[0]).to.equal(2); // 2 registered voters
    expect(stats[1]).to.equal(2); // 2 votes cast
    expect(stats[4]).to.equal(100); // 100% turnout
  });
  
  it("Should test admin restrictions", async function () {
    console.log("\n=== Testing Admin Restrictions ===");
    
    // Test that non-admin cannot create district
    await expect(
      election.connect(voters[0]).createDistrict("Unauthorized District")
    ).to.be.reverted;
    
    console.log("✓ Non-admin correctly prevented from creating district");
  });
});