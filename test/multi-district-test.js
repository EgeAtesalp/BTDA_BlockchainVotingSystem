const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Final Multi-District Election Test", function () {
    
    it("Should complete a full multi-district election successfully", async function () {
        console.log("🗳️ FINAL TEST: Complete Multi-District Election");
        console.log("=".repeat(60));
        
        // Get signers
        const [admin, voter1, voter2, voter3, voter4, voter5, voter6] = await ethers.getSigners();
        
        // Deploy contract
        console.log("Step 1: Deploying contracts...");
        const OrchestratorFactory = await ethers.getContractFactory("ElectionOrchestrator");
        const orchestrator = await OrchestratorFactory.deploy();
        await orchestrator.waitForDeployment();
        
        const contractAddress = await orchestrator.getAddress();
        console.log(`   ✅ Orchestrator deployed at: ${contractAddress}`);
        
        // Verify basic setup
        const contractAdmin = await orchestrator.admin();
        expect(contractAdmin).to.equal(admin.address);
        
        // Add candidates
        console.log("Step 2: Adding candidates...");
        
        console.log("   Adding Alice...");
        const tx1 = await orchestrator.addCandidate("Alice Johnson", "Progressive Party");
        const receipt1 = await tx1.wait();
        console.log(`   Alice transaction: ${receipt1.transactionHash}`);
        
        const count1 = await orchestrator.getCandidateCount();
        console.log(`   Candidate count after Alice: ${Number(count1)}`);
        
        console.log("   Adding Bob...");
        const tx2 = await orchestrator.addCandidate("Bob Smith", "Conservative Party");
        const receipt2 = await tx2.wait();
        console.log(`   Bob transaction: ${receipt2.transactionHash}`);
        
        // Verify candidates
        const candidateCount = await orchestrator.getCandidateCount();
        console.log(`   Final candidate count: ${Number(candidateCount)}`);
        
        if (Number(candidateCount) !== 2) {
            console.log("   ❌ CANDIDATE COUNT MISMATCH!");
            console.log("   Attempting to debug candidate storage...");
            
            try {
                const alice = await orchestrator.getCandidate(0);
                console.log(`   Candidate 0 exists: ${alice.name}`);
            } catch (error) {
                console.log(`   Candidate 0 NOT found: ${error.message}`);
            }
            
            try {
                const bob = await orchestrator.getCandidate(1);
                console.log(`   Candidate 1 exists: ${bob.name}`);
            } catch (error) {
                console.log(`   Candidate 1 NOT found: ${error.message}`);
            }
        }
        
        expect(Number(candidateCount)).to.equal(2);
        
        const alice = await orchestrator.getCandidate(0);
        const bob = await orchestrator.getCandidate(1);
        
        console.log(`   ✅ Candidate 0: ${alice.name} (${alice.party})`);
        console.log(`   ✅ Candidate 1: ${bob.name} (${bob.party})`);
        
        expect(alice.name).to.equal("Alice Johnson");
        expect(bob.name).to.equal("Bob Smith");
        
        // Create districts
        console.log("Step 3: Creating districts...");
        
        console.log("   Creating Downtown District...");
        const districtTx1 = await orchestrator.createDistrict("Downtown District");
        const districtReceipt1 = await districtTx1.wait();
        console.log(`   Downtown transaction: ${districtReceipt1.transactionHash}`);
        
        const districtCount1 = await orchestrator.getElectionStats();
        console.log(`   Districts after Downtown: ${Number(districtCount1._totalDistricts)}`);
        
        console.log("   Creating Suburban District...");
        const districtTx2 = await orchestrator.createDistrict("Suburban District");
        const districtReceipt2 = await districtTx2.wait();
        console.log(`   Suburban transaction: ${districtReceipt2.transactionHash}`);
        
        const districtCount2 = await orchestrator.getElectionStats();
        console.log(`   Districts after Suburban: ${Number(districtCount2._totalDistricts)}`);
        
        console.log("   Creating Rural District...");
        const districtTx3 = await orchestrator.createDistrict("Rural District");
        const districtReceipt3 = await districtTx3.wait();
        console.log(`   Rural transaction: ${districtReceipt3.transactionHash}`);
        
        // Verify districts
        const stats = await orchestrator.getElectionStats();
        console.log(`   ✅ Districts created: ${Number(stats._totalDistricts)}`);
        
        if (Number(stats._totalDistricts) !== 3) {
            console.log("   ❌ DISTRICT COUNT MISMATCH!");
            console.log("   Attempting to debug district storage...");
            
            const metrics = await orchestrator.getElectionMetrics();
            console.log(`   Metrics districts: ${Number(metrics.totalDistrictsCreated)}`);
            
            const factoryAddress = await orchestrator.getFactoryAddress();
            const factory = await ethers.getContractAt("DistrictFactory", factoryAddress);
            const factoryCount = await factory.getDistrictCount();
            console.log(`   Factory district count: ${Number(factoryCount)}`);
            
            for (let i = 0; i < 3; i++) {
                try {
                    const districtAddr = await orchestrator.getDistrictAddress(i);
                    console.log(`   District ${i} address: ${districtAddr}`);
                } catch (error) {
                    console.log(`   District ${i} NOT found: ${error.message}`);
                }
            }
        }
        
        expect(Number(stats._totalDistricts)).to.equal(3);
        
        // Get district addresses
        const district0Address = await orchestrator.getDistrictAddress(0);
        const district1Address = await orchestrator.getDistrictAddress(1);
        const district2Address = await orchestrator.getDistrictAddress(2);
        
        console.log(`   ✅ Downtown District: ${district0Address}`);
        console.log(`   ✅ Suburban District: ${district1Address}`);
        console.log(`   ✅ Rural District: ${district2Address}`);
        
        // Start registration
        console.log("Step 4: Starting registration...");
        
        const stateBefore = await orchestrator.state();
        console.log(`   State before registration: ${Number(stateBefore)}`);
        
        console.log("   Calling startRegistration...");
        const regTx = await orchestrator.startRegistration();
        const regReceipt = await regTx.wait();
        console.log(`   Registration transaction: ${regReceipt.transactionHash}`);
        
        const stateAfter = await orchestrator.state();
        console.log(`   State after registration: ${Number(stateAfter)}`);
        
        if (Number(stateAfter) !== 1) {
            console.log("   ❌ REGISTRATION STATE MISMATCH!");
            console.log("   Debugging registration requirements...");
            
            const candidateCount = await orchestrator.getCandidateCount();
            const stats = await orchestrator.getElectionStats();
            const emergencyStop = await orchestrator.emergencyStop();
            
            console.log(`   Candidate count: ${Number(candidateCount)}`);
            console.log(`   District count: ${Number(stats._totalDistricts)}`);
            console.log(`   Emergency stop: ${emergencyStop}`);
            console.log(`   Admin check: ${await orchestrator.admin()}`);
        }
        
        expect(Number(stateAfter)).to.equal(1);
        
        // Register voters
        console.log("Step 5: Registering voters...");
        
        console.log("   Registering voters in Downtown District...");
        const voterTx1 = await orchestrator.batchRegisterVoters(0, [voter1.address, voter2.address]);
        const voterReceipt1 = await voterTx1.wait();
        console.log(`   Downtown voter registration: ${voterReceipt1.transactionHash}`);
        
        const stats1 = await orchestrator.getElectionStats();
        console.log(`   Voters after Downtown: ${Number(stats1._totalVotersRegistered)}`);
        
        console.log("   Registering voters in Suburban District...");
        const voterTx2 = await orchestrator.batchRegisterVoters(1, [voter3.address, voter4.address]);
        const voterReceipt2 = await voterTx2.wait();
        console.log(`   Suburban voter registration: ${voterReceipt2.transactionHash}`);
        
        const stats2 = await orchestrator.getElectionStats();
        console.log(`   Voters after Suburban: ${Number(stats2._totalVotersRegistered)}`);
        
        console.log("   Registering voters in Rural District...");
        const voterTx3 = await orchestrator.batchRegisterVoters(2, [voter5.address, voter6.address]);
        const voterReceipt3 = await voterTx3.wait();
        console.log(`   Rural voter registration: ${voterReceipt3.transactionHash}`);
        
        const regStats = await orchestrator.getElectionStats();
        console.log(`   ✅ Total voters registered: ${Number(regStats._totalVotersRegistered)}`);
        
        if (Number(regStats._totalVotersRegistered) !== 6) {
            console.log("   ❌ VOTER REGISTRATION MISMATCH!");
            console.log("   Debugging voter registration...");
            
            // Check individual district registrations
            for (let i = 0; i < 3; i++) {
                try {
                    const districtAddr = await orchestrator.getDistrictAddress(i);
                    const district = await ethers.getContractAt("DistrictVoting", districtAddr);
                    const districtStats = await district.getDistrictStats();
                    console.log(`   District ${i} registered voters: ${Number(districtStats._totalRegistered)}`);
                } catch (error) {
                    console.log(`   District ${i} error: ${error.message}`);
                }
            }
        }
        
        expect(Number(regStats._totalVotersRegistered)).to.equal(6);
        
        // Start voting
        console.log("Step 6: Starting voting...");
        
        const votingStateBefore = await orchestrator.state();
        console.log(`   State before voting: ${Number(votingStateBefore)}`);
        
        console.log("   Calling startVoting...");
        const votingTx = await orchestrator.startVoting();
        const votingReceipt = await votingTx.wait();
        console.log(`   Voting transaction: ${votingReceipt.transactionHash}`);
        
        const votingStateAfter = await orchestrator.state();
        console.log(`   State after voting: ${Number(votingStateAfter)}`);
        
        if (Number(votingStateAfter) !== 2) {
            console.log("   ❌ VOTING STATE MISMATCH!");
            console.log("   Debugging voting requirements...");
            
            const currentStats = await orchestrator.getElectionStats();
            console.log(`   Voters registered: ${Number(currentStats._totalVotersRegistered)}`);
            console.log(`   Districts: ${Number(currentStats._totalDistricts)}`);
        }
        
        expect(Number(votingStateAfter)).to.equal(2);
        
        // Cast votes
        console.log("Step 7: Casting votes...");
        
        const district0 = await ethers.getContractAt("DistrictVoting", district0Address);
        const district1 = await ethers.getContractAt("DistrictVoting", district1Address);
        const district2 = await ethers.getContractAt("DistrictVoting", district2Address);
        
        // Downtown District - Alice favored
        console.log("   Downtown District voting (Alice favored)...");
        console.log(`     Voter1 (${voter1.address.slice(0,8)}...) casting vote [10, 2]...`);
        const vote1Tx = await district0.connect(voter1).castVote([10, 2]);
        const vote1Receipt = await vote1Tx.wait();
        console.log(`     Vote1 transaction: ${vote1Receipt.transactionHash}`);
        
        console.log(`     Voter2 (${voter2.address.slice(0,8)}...) casting vote [9, 3]...`);
        const vote2Tx = await district0.connect(voter2).castVote([9, 3]);
        const vote2Receipt = await vote2Tx.wait();
        console.log(`     Vote2 transaction: ${vote2Receipt.transactionHash}`);
        
        const d0VotesAfter = await district0.getDistrictStats();
        console.log(`     Downtown votes after: ${Number(d0VotesAfter._totalVotes)}`);
        
        // Suburban District - Bob favored
        console.log("   Suburban District voting (Bob favored)...");
        console.log(`     Voter3 (${voter3.address.slice(0,8)}...) casting vote [2, 10]...`);
        const vote3Tx = await district1.connect(voter3).castVote([2, 10]);
        const vote3Receipt = await vote3Tx.wait();
        console.log(`     Vote3 transaction: ${vote3Receipt.transactionHash}`);
        
        console.log(`     Voter4 (${voter4.address.slice(0,8)}...) casting vote [3, 9]...`);
        const vote4Tx = await district1.connect(voter4).castVote([3, 9]);
        const vote4Receipt = await vote4Tx.wait();
        console.log(`     Vote4 transaction: ${vote4Receipt.transactionHash}`);
        
        const d1VotesAfter = await district1.getDistrictStats();
        console.log(`     Suburban votes after: ${Number(d1VotesAfter._totalVotes)}`);
        
        // Rural District - Close race
        console.log("   Rural District voting (Close race)...");
        console.log(`     Voter5 (${voter5.address.slice(0,8)}...) casting vote [7, 6]...`);
        const vote5Tx = await district2.connect(voter5).castVote([7, 6]);
        const vote5Receipt = await vote5Tx.wait();
        console.log(`     Vote5 transaction: ${vote5Receipt.transactionHash}`);
        
        console.log(`     Voter6 (${voter6.address.slice(0,8)}...) casting vote [6, 7]...`);
        const vote6Tx = await district2.connect(voter6).castVote([6, 7]);
        const vote6Receipt = await vote6Tx.wait();
        console.log(`     Vote6 transaction: ${vote6Receipt.transactionHash}`);
        
        const d2VotesAfter = await district2.getDistrictStats();
        console.log(`     Rural votes after: ${Number(d2VotesAfter._totalVotes)}`);
        
        // Verify all votes cast
        const d0Stats = await district0.getDistrictStats();
        const d1Stats = await district1.getDistrictStats();
        const d2Stats = await district2.getDistrictStats();
        
        console.log(`   ✅ Downtown: ${Number(d0Stats._totalVotes)} votes cast`);
        console.log(`   ✅ Suburban: ${Number(d1Stats._totalVotes)} votes cast`);
        console.log(`   ✅ Rural: ${Number(d2Stats._totalVotes)} votes cast`);
        
        if (Number(d0Stats._totalVotes) !== 2 || Number(d1Stats._totalVotes) !== 2 || Number(d2Stats._totalVotes) !== 2) {
            console.log("   ❌ VOTE CASTING MISMATCH!");
            console.log("   Debugging vote casting...");
            
            // Check district states
            console.log(`   Downtown district state: ${Number(d0Stats._state)}`);
            console.log(`   Suburban district state: ${Number(d1Stats._state)}`);
            console.log(`   Rural district state: ${Number(d2Stats._state)}`);
            
            // Check voter registrations in districts
            console.log(`   Downtown registered voters: ${Number(d0Stats._totalRegistered)}`);
            console.log(`   Suburban registered voters: ${Number(d1Stats._totalRegistered)}`);
            console.log(`   Rural registered voters: ${Number(d2Stats._totalRegistered)}`);
        }
        
        expect(Number(d0Stats._totalVotes)).to.equal(2);
        expect(Number(d1Stats._totalVotes)).to.equal(2);
        expect(Number(d2Stats._totalVotes)).to.equal(2);
        
        // End voting
        console.log("Step 8: Ending voting...");
        
        const endVotingStateBefore = await orchestrator.state();
        console.log(`   State before ending voting: ${Number(endVotingStateBefore)}`);
        
        console.log("   Calling endVoting...");
        const endVotingTx = await orchestrator.endVoting();
        const endVotingReceipt = await endVotingTx.wait();
        console.log(`   End voting transaction: ${endVotingReceipt.transactionHash}`);
        
        const endVotingStateAfter = await orchestrator.state();
        console.log(`   State after ending voting: ${Number(endVotingStateAfter)}`);
        
        expect(Number(endVotingStateAfter)).to.equal(3);
        
        // Collect results
        console.log("Step 9: Collecting results...");
        
        const collectStateBefore = await orchestrator.state();
        console.log(`   State before collecting: ${Number(collectStateBefore)}`);
        
        console.log("   Calling collectResults...");
        const collectTx = await orchestrator.collectResults();
        const collectReceipt = await collectTx.wait();
        console.log(`   Collect results transaction: ${collectReceipt.transactionHash}`);
        
        const collectStateAfter = await orchestrator.state();
        console.log(`   State after collecting: ${Number(collectStateAfter)}`);
        
        expect(Number(collectStateAfter)).to.equal(4);
        
        // Analyze results
        console.log("Step 10: Analyzing results...");
        
        // Get district results
        const d0Results = await district0.getDistrictResults();
        const d1Results = await district1.getDistrictResults();
        const d2Results = await district2.getDistrictResults();
        
        console.log("\n" + "=".repeat(60));
        console.log("📊 DISTRICT-BY-DISTRICT RESULTS");
        console.log("=".repeat(60));
        
        console.log("Downtown District (Alice favored):");
        console.log(`  Alice: ${Number(d0Results.scores[0])} points`);
        console.log(`  Bob:   ${Number(d0Results.scores[1])} points`);
        
        console.log("Suburban District (Bob favored):");
        console.log(`  Alice: ${Number(d1Results.scores[0])} points`);
        console.log(`  Bob:   ${Number(d1Results.scores[1])} points`);
        
        console.log("Rural District (Close race):");
        console.log(`  Alice: ${Number(d2Results.scores[0])} points`);
        console.log(`  Bob:   ${Number(d2Results.scores[1])} points`);
        
        // Get final aggregated results
        const finalResults = await orchestrator.getElectionResults();
        const winner = await orchestrator.getWinner();
        
        const aliceTotal = Number(finalResults.totalScores[0]);
        const bobTotal = Number(finalResults.totalScores[1]);
        
        console.log("\n" + "=".repeat(60));
        console.log("📊 FINAL AGGREGATED RESULTS");
        console.log("=".repeat(60));
        console.log(`Alice Johnson (Progressive): ${aliceTotal} points`);
        console.log(`Bob Smith (Conservative):    ${bobTotal} points`);
        console.log("=".repeat(60));
        console.log(`🏆 WINNER: ${winner.winnerName} with ${Number(winner.winnerScore)} points!`);
        console.log("=".repeat(60));
        
        // Verify the math
        // Alice: (10+9) + (2+3) + (7+6) = 19 + 5 + 13 = 37
        // Bob:   (2+3) + (10+9) + (6+7) = 5 + 19 + 13 = 37
        // It's a tie! Let's check who wins in case of tie (first candidate or higher ID)
        console.log(`\n📊 Vote Calculation:`);
        console.log(`Alice: (10+9) + (2+3) + (7+6) = 19 + 5 + 13 = 37`);
        console.log(`Bob:   (2+3) + (10+9) + (6+7) = 5 + 19 + 13 = 37`);
        
        expect(aliceTotal).to.equal(37);
        expect(bobTotal).to.equal(37);
        
        // In case of tie, check which candidate the contract declares as winner
        console.log(`🏆 Winner declared: ${winner.winnerName} (${Number(winner.winnerScore)} points)`);
        
        // Verify final stats
        const finalStats = await orchestrator.getElectionStats();
        expect(Number(finalStats._totalVotesCast)).to.equal(6);
        expect(Number(finalStats._resultsSubmitted)).to.equal(3);
        expect(Number(finalStats._turnoutPercentage)).to.equal(100);
        
        console.log("\n" + "🎉".repeat(20));
        console.log("🎉 MULTI-DISTRICT ELECTION COMPLETED SUCCESSFULLY! 🎉");
        console.log("🎉".repeat(20));
        console.log(`📊 Summary: 3 districts, 6 voters, ${winner.winnerName} wins!`);
        console.log(`🚀 Distributed voting system works perfectly!`);
        console.log(`⚡ Ready for scaling tests with virtual agents!`);
    });
});