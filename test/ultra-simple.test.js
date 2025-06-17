// test/ultra-simple.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Ultra Simple Test", function () {
  
  it("Should test the simplest possible operations", async function () {
    const [admin] = await ethers.getSigners();
    
    console.log("=== ULTRA SIMPLE TEST ===");
    console.log("Admin:", admin.address);
    
    // Deploy contract
    const ScoreVotingElection = await ethers.getContractFactory("ScoreVotingElection");
    const election = await ScoreVotingElection.deploy();
    await election.waitForDeployment();
    
    console.log("Contract deployed to:", await election.getAddress());
    console.log("Contract admin:", await election.admin());
    
    // Test 1: Check initial state
    console.log("\n--- Initial State ---");
    console.log("District count (initial):", (await election.districtCount()).toString());
    console.log("Candidate count (initial):", (await election.candidateCount()).toString());
    
    // Test 2: Try to create district with very detailed logging
    console.log("\n--- Creating District ---");
    console.log("About to call createDistrict...");
    
    try {
      // Call the function step by step
      const tx = await election.createDistrict("Test District");
      console.log("Transaction created:", tx.hash);
      
      // Wait for mining
      const receipt = await tx.wait();
      console.log("Transaction mined!");
      console.log("Gas used:", receipt.gasUsed.toString());
      console.log("Status:", receipt.status); // Should be 1 for success
      
      // Check the state immediately after
      console.log("\n--- After District Creation ---");
      const newDistrictCount = await election.districtCount();
      console.log("District count (after creation):", newDistrictCount.toString());
      
      if (newDistrictCount.toString() === "1") {
        console.log("✅ SUCCESS: District count increased!");
        
        // Try to get the district
        try {
          const district = await election.getDistrict(0);
          console.log("District 0 data:", district);
        } catch (error) {
          console.log("❌ ERROR getting district:", error.message);
        }
      } else {
        console.log("❌ FAILURE: District count did NOT increase!");
        console.log("Expected: 1, Got:", newDistrictCount.toString());
      }
      
    } catch (error) {
      console.log("❌ ERROR in createDistrict:", error.message);
      throw error;
    }
    
    // Test 3: Try candidate creation
    console.log("\n--- Creating Candidate ---");
    try {
      const tx = await election.addCandidate("Alice", "Progressive");
      const receipt = await tx.wait();
      console.log("Candidate transaction mined, status:", receipt.status);
      
      const candidateCount = await election.candidateCount();
      console.log("Candidate count after creation:", candidateCount.toString());
      
      if (candidateCount.toString() === "1") {
        console.log("✅ SUCCESS: Candidate count increased!");
      } else {
        console.log("❌ FAILURE: Candidate count did NOT increase!");
      }
      
    } catch (error) {
      console.log("❌ ERROR in addCandidate:", error.message);
    }
  });
});