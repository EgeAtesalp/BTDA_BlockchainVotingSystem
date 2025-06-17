// test/ScoreVotingElection.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ScoreVotingElection", function () {
  let election;
  let admin;
  let voters;
  
  beforeEach(async function () {
    [admin, ...voters] = await ethers.getSigners();
    
    const ScoreVotingElection = await ethers.getContractFactory("ScoreVotingElection");
    election = await ScoreVotingElection.deploy();
    await election.waitForDeployment();
  });
  
  describe("Deployment", function () {
    it("Should set the deployer as admin", async function () {
      expect(await election.admin()).to.equal(admin.address);
    });
    
    it("Should start in Registration state", async function () {
      expect(await election.state()).to.equal(0); // Registration = 0
    });
  });
  
  describe("District Management", function () {
    it("Should create districts", async function () {
      await election.createDistrict("California");
      const district = await election.getDistrict(0);
      expect(district[0]).to.equal("California"); // name
      expect(district[3]).to.equal(true); // isActive
    });
  });
  
  describe("Candidate Management", function () {
    it("Should add candidates", async function () {
      await election.addCandidate("Alice", "Progressive");
      const candidate = await election.getCandidate(0);
      expect(candidate[1]).to.equal("Alice"); // name
      expect(candidate[2]).to.equal("Progressive"); // party
    });
  });
  
  describe("Voter Registration", function () {
    beforeEach(async function () {
      await election.createDistrict("Test District");
      await election.addCandidate("Alice", "Party A");
      await election.addCandidate("Bob", "Party B");
    });
    
    it("Should register voters", async function () {
      await election.registerVoter(voters[0].address, 0);
      const voter = await election.voters(voters[0].address);
      expect(voter.isRegistered).to.equal(true);
      expect(voter.district).to.equal(0);
    });
    
    it("Should prevent duplicate registration", async function () {
      await election.registerVoter(voters[0].address, 0);
      await expect(
        election.registerVoter(voters[0].address, 0)
      ).to.be.revertedWith("Voter already registered");
    });
  });
  
  describe("Score Voting", function () {
    beforeEach(async function () {
      // Setup election
      await election.createDistrict("Test District");
      await election.addCandidate("Alice", "Party A");
      await election.addCandidate("Bob", "Party B");
      await election.addCandidate("Carol", "Party C");
      
      // Register voters
      await election.registerVoter(voters[0].address, 0);
      await election.registerVoter(voters[1].address, 0);
      
      // Start voting
      await election.startVoting();
    });
    
    it("Should accept valid score votes", async function () {
      const scores = [8, 5, 2]; // Alice: 8, Bob: 5, Carol: 2
      await election.connect(voters[0]).castVote(scores);
      
      const voter = await election.voters(voters[0].address);
      expect(voter.hasVoted).to.equal(true);
      
      // Check candidate scores
      const alice = await election.getCandidate(0);
      expect(alice[3]).to.equal(8); // totalScore
    });
    
    it("Should reject invalid scores", async function () {
      const invalidScores = [15, 5, 2]; // 15 is > MAX_SCORE (10)
      await expect(
        election.connect(voters[0]).castVote(invalidScores)
      ).to.be.revertedWith("Score out of range");
    });
    
    it("Should prevent double voting", async function () {
      const scores = [8, 5, 2];
      await election.connect(voters[0]).castVote(scores);
      
      await expect(
        election.connect(voters[0]).castVote(scores)
      ).to.be.revertedWith("Already voted");
    });
    
    it("Should calculate results correctly", async function () {
      // Voter 1: Alice=10, Bob=5, Carol=0
      await election.connect(voters[0]).castVote([10, 5, 0]);
      
      // Voter 2: Alice=8, Bob=7, Carol=9
      await election.connect(voters[1]).castVote([8, 7, 9]);
      
      await election.endElection();
      
      const results = await election.getResults();
      
      // Alice should have total score of 18 (10+8)
      expect(results[1][0]).to.equal(18);
      // Bob should have total score of 12 (5+7)  
      expect(results[1][1]).to.equal(12);
      // Carol should have total score of 9 (0+9)
      expect(results[1][2]).to.equal(9);
    });
  });
});