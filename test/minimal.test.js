// test/minimal.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MinimalVoting", function () {
  let voting;
  let admin;
  let user;
  
  beforeEach(async function () {
    [admin, user] = await ethers.getSigners();
    
    const MinimalVoting = await ethers.getContractFactory("MinimalVoting");
    voting = await MinimalVoting.deploy();
    await voting.waitForDeployment();
    
    console.log("Admin:", admin.address);
    console.log("Contract:", await voting.getAddress());
  });
  
  it("Should work with basic operations", async function () {
    console.log("\n=== Testing Minimal Contract ===");
    
    // Check initial state
    console.log("Initial district count:", await voting.districtCount());
    console.log("Initial candidate count:", await voting.candidateCount());
    console.log("Admin from contract:", await voting.admin());
    
    // Create district
    console.log("\nCreating district...");
    const tx1 = await voting.createDistrict("Test District");
    await tx1.wait();
    console.log("District count after creation:", await voting.districtCount());
    
    // Get district
    if (await voting.districtCount() > 0) {
      const district = await voting.getDistrict(0);
      console.log("District 0:", district);
    }
    
    // Add candidate
    console.log("\nAdding candidate...");
    const tx2 = await voting.addCandidate("Alice");
    await tx2.wait();
    console.log("Candidate count after creation:", await voting.candidateCount());
    
    // Get candidate
    if (await voting.candidateCount() > 0) {
      const candidate = await voting.getCandidate(0);
      console.log("Candidate 0:", candidate);
    }
    
    // Test admin restriction
    console.log("\nTesting admin restriction...");
    try {
      await voting.connect(user).createDistrict("Unauthorized District");
      console.log("ERROR: Non-admin was allowed!");
    } catch (error) {
      console.log("✓ Non-admin correctly blocked:", error.reason);
    }
    
    // Final assertions
    expect(await voting.districtCount()).to.equal(1);
    expect(await voting.candidateCount()).to.equal(1);
  });
});