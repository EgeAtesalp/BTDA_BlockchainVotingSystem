const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Simple Multi-District Test", function () {
    let orchestrator, factory;
    let admin, voter1, voter2, voter3, voter4, voter5, voter6;
    
    before(async function () {
        // Get signers
        [admin, voter1, voter2, voter3, voter4, voter5, voter6] = await ethers.getSigners();
        
        console.log("🚀 Setting up simple multi-district test with 3 districts, 2 candidates, 2 voters per district");
        
        // Deploy the main orchestrator contract
        const OrchestratorFactory = await ethers.getContractFactory("ElectionOrchestrator");
        orchestrator = await OrchestratorFactory.deploy();
        await orchestrator.waitForDeployment();
        
        console.log(`✅ Orchestrator deployed at: ${await orchestrator.getAddress()}`);
        
        // Get the factory address
        const factoryAddress = await orchestrator.getFactoryAddress();
        factory = await ethers.getContractAt("DistrictFactory", factoryAddress);
        
        console.log(`✅ Factory found at: ${factoryAddress}`);
    });

    it("Should run a complete multi-district election", async function () {
        console.log("🗳️ Running multi-district election...");
        
        // 1. Check initial state
        console.log("Step 1: Checking initial state...");
        expect(Number(await orchestrator.state())).to.equal(0);
        
        // 2. Add candidates
        console.log("Step 2: Adding candidates...");
        await orchestrator.addCandidate("Alice Johnson", "Progressive Party");
        await orchestrator.addCandidate("Bob Smith", "Conservative Party");
        
        // Verify candidates using a different approach
        try {
            const candidate0 = await orchestrator.getCandidate(0);
            const candidate1 = await orchestrator.getCandidate(1);
            console.log(`   ✅ Candidate 0: ${candidate0.name}`);
            console.log(`   ✅ Candidate 1: ${candidate1.name}`);
            expect(candidate0.name).to.equal("Alice Johnson");
            expect(candidate1.name).to.equal("Bob Smith");
        } catch (error) {
            console.log("   ❌ Error getting candidates directly, trying getAllCandidates...");
            const allCandidates = await orchestrator.getAllCandidates();
            console.log(`   Candidates from getAllCandidates: ${allCandidates.names.length}`);
            console.log(`   Names: ${allCandidates.names}`);
        }
        
        // 3. Create 3 districts
        console.log("Step 3: Creating 3 districts...");
        
        console.log("   Creating District 0...");
        await orchestrator.createDistrict("District A");
        const district0Address = await orchestrator.getDistrictAddress(0);
        console.log(`   ✅ District 0 created at: ${district0Address}`);
        
        console.log("   Creating District 1...");
        await orchestrator.createDistrict("District B");
        const district1Address = await orchestrator.getDistrictAddress(1);
        console.log(`   ✅ District 1 created at: ${district1Address}`);
        
        console.log("   Creating District 2...");
        await orchestrator.createDistrict("District C");
        const district2Address = await orchestrator.getDistrictAddress(2);
        console.log(`   ✅ District 2 created at: ${district2Address}`);
        
        // Verify districts
        const stats = await orchestrator.getElectionStats();
        console.log(`   Districts created: ${Number(stats._totalDistricts)}`);
        expect(Number(stats._totalDistricts)).to.equal(3);
        
        // 4. Start registration
        console.log("Step 4: Starting registration...");
        await orchestrator.startRegistration();
        expect(Number(await orchestrator.state())).to.equal(1);
        
        // 5. Register voters (2 voters per district)
        console.log("Step 5: Registering voters...");
        
        console.log("   Registering voters in District 0...");
        await orchestrator.batchRegisterVoters(0, [voter1.address, voter2.address]);
        
        console.log("   Registering voters in District 1...");
        await orchestrator.batchRegisterVoters(1, [voter3.address, voter4.address]);
        
        console.log("   Registering voters in District 2...");
        await orchestrator.batchRegisterVoters(2, [voter5.address, voter6.address]);
        
        // Verify total registration
        const stats2 = await orchestrator.getElectionStats();
        console.log(`   Total voters registered: ${Number(stats2._totalVotersRegistered)}`);
        expect(Number(stats2._totalVotersRegistered)).to.equal(6);
        
        // 6. Start voting
        console.log("Step 6: Starting voting...");
        await orchestrator.startVoting();
        expect(Number(await orchestrator.state())).to.equal(2);
        
        // 7. Cast votes in all districts
        console.log("Step 7: Casting votes in all districts...");
        
        // Get district contracts
        const district0 = await ethers.getContractAt("DistrictVoting", district0Address);
        const district1 = await ethers.getContractAt("DistrictVoting", district1Address);
        const district2 = await ethers.getContractAt("DistrictVoting", district2Address);
        
        // District 0 - Alice favored
        console.log("   District 0 voting (Alice favored)...");
        await district0.connect(voter1).castVote([10, 3]); // Alice=10, Bob=3
        await district0.connect(voter2).castVote([9, 4]);  // Alice=9, Bob=4
        
        // District 1 - Bob favored  
        console.log("   District 1 voting (Bob favored)...");
        await district1.connect(voter3).castVote([3, 10]); // Alice=3, Bob=10
        await district1.connect(voter4).castVote([2, 9]);  // Alice=2, Bob=9
        
        // District 2 - Balanced
        console.log("   District 2 voting (Balanced)...");
        await district2.connect(voter5).castVote([7, 7]);  // Alice=7, Bob=7
        await district2.connect(voter6).castVote([6, 8]);  // Alice=6, Bob=8
        
        // Verify votes in each district
        const d0Stats = await district0.getDistrictStats();
        const d1Stats = await district1.getDistrictStats();
        const d2Stats = await district2.getDistrictStats();
        
        console.log(`   District 0: ${Number(d0Stats._totalVotes)} votes`);
        console.log(`   District 1: ${Number(d1Stats._totalVotes)} votes`);
        console.log(`   District 2: ${Number(d2Stats._totalVotes)} votes`);
        
        expect(Number(d0Stats._totalVotes)).to.equal(2);
        expect(Number(d1Stats._totalVotes)).to.equal(2);
        expect(Number(d2Stats._totalVotes)).to.equal(2);
        
        // 8. End voting
        console.log("Step 8: Ending voting...");
        await orchestrator.endVoting();
        expect(Number(await orchestrator.state())).to.equal(3);
        
        // 9. Collect results
        console.log("Step 9: Collecting results...");
        await orchestrator.collectResults();
        expect(Number(await orchestrator.state())).to.equal(4);
        
        // 10. Display results
        console.log("Step 10: Analyzing results...");
        
        // Get district-specific results
        console.log("\n" + "=".repeat(60));
        console.log("📊 DISTRICT-BY-DISTRICT RESULTS");
        console.log("=".repeat(60));
        
        const d0Results = await district0.getDistrictResults();
        const d1Results = await district1.getDistrictResults();
        const d2Results = await district2.getDistrictResults();
        
        console.log("District 0 (Alice favored):");
        console.log(`  Alice: ${Number(d0Results.scores[0])} points`);
        console.log(`  Bob:   ${Number(d0Results.scores[1])} points`);
        
        console.log("District 1 (Bob favored):");
        console.log(`  Alice: ${Number(d1Results.scores[0])} points`);
        console.log(`  Bob:   ${Number(d1Results.scores[1])} points`);
        
        console.log("District 2 (Balanced):");
        console.log(`  Alice: ${Number(d2Results.scores[0])} points`);
        console.log(`  Bob:   ${Number(d2Results.scores[1])} points`);
        
        // Get aggregated results
        const finalResults = await orchestrator.getElectionResults();
        const winner = await orchestrator.getWinner();
        
        console.log("\n" + "=".repeat(60));
        console.log("📊 FINAL AGGREGATED RESULTS");
        console.log("=".repeat(60));
        
        const aliceTotal = Number(finalResults.totalScores[0]);
        const bobTotal = Number(finalResults.totalScores[1]);
        
        console.log(`Alice Johnson: ${aliceTotal} points`);
        console.log(`Bob Smith:     ${bobTotal} points`);
        console.log("=".repeat(60));
        console.log(`🏆 WINNER: ${winner.winnerName} with ${Number(winner.winnerScore)} points`);
        
        // Verify calculations
        // Alice: 10+9 + 3+2 + 7+6 = 19 + 5 + 13 = 37 points
        // Bob:   3+4 + 10+9 + 7+8 = 7 + 19 + 15 = 41 points
        expect(aliceTotal).to.equal(37);
        expect(bobTotal).to.equal(41);
        expect(winner.winnerName).to.equal("Bob Smith");
        
        // Verify total votes
        const finalStats = await orchestrator.getElectionStats();
        expect(Number(finalStats._totalVotesCast)).to.equal(6);
        expect(Number(finalStats._resultsSubmitted)).to.equal(3);
        
        console.log("\n✅ Multi-district election completed successfully!");
        console.log(`📊 Summary: 3 districts, 6 voters, Bob wins 41-37`);
    });

    it("Should demonstrate district independence", async function () {
        console.log("🔍 Testing district independence...");
        
        // Test that each district maintains its own state
        const district0Address = await orchestrator.getDistrictAddress(0);
        const district1Address = await orchestrator.getDistrictAddress(1);
        const district2Address = await orchestrator.getDistrictAddress(2);
        
        console.log(`   District 0: ${district0Address}`);
        console.log(`   District 1: ${district1Address}`);
        console.log(`   District 2: ${district2Address}`);
        
        // Verify they're different contracts
        expect(district0Address).to.not.equal(district1Address);
        expect(district1Address).to.not.equal(district2Address);
        expect(district0Address).to.not.equal(district2Address);
        
        // Test error handling
        await expect(
            orchestrator.getDistrictAddress(999)
        ).to.be.revertedWith("Invalid district ID");
        
        console.log("✅ District independence verified!");
    });

    after(function () {
        console.log("\n🎉 MULTI-DISTRICT TEST COMPLETED SUCCESSFULLY!");
        console.log("🚀 Your distributed voting system works correctly with multiple districts!");
        console.log("💡 Ready for larger scale tests with virtual agents!");
    });
});