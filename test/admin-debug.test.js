// test/admin-debug.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Admin Debug Test", function () {
  
  it("Should debug admin restriction", async function () {
    const [admin, user] = await ethers.getSigners();
    
    const MinimalVoting = await ethers.getContractFactory("MinimalVoting");
    const voting = await MinimalVoting.deploy();
    await voting.waitForDeployment();
    
    console.log("=== ADMIN DEBUG ===");
    console.log("Admin address:", admin.address);
    console.log("User address:", user.address);
    console.log("Contract admin:", await voting.admin());
    console.log("Admin == Contract admin?", admin.address === await voting.admin());
    
    // Test admin call
    console.log("\nTesting admin call:");
    console.log("msg.sender will be:", admin.address);
    const tx1 = await voting.connect(admin).createDistrict("Admin District");
    await tx1.wait();
    console.log("Admin call successful, district count:", await voting.districtCount());
    
    // Test non-admin call with detailed info
    console.log("\nTesting non-admin call:");
    console.log("msg.sender will be:", user.address);
    console.log("Contract expects:", await voting.admin());
    console.log("Are they equal?", user.address === await voting.admin());
    
    try {
      const tx2 = await voting.connect(user).createDistrict("User District");
      await tx2.wait();
      console.log("ERROR: Non-admin call succeeded! District count:", await voting.districtCount());
    } catch (error) {
      console.log("SUCCESS: Non-admin call failed with:", error.reason);
    }
  });
});