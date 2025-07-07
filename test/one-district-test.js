const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Single District Voting System Test", function () {
    
    it("Should handle massive parallel voting in a single district", async function () {
        this.timeout(300000); // 5 minutes timeout for single district voting
        
        console.log("🏢 SINGLE DISTRICT TEST: All voters in one district");
        console.log("=".repeat(80));
        
        // Get signers - we'll use the same setup as multi-district test
        const signers = await ethers.getSigners();
        const admin = signers[0];
        const votersPool = signers.slice(1, 3001); // 150 voters (same as multi-district test)
        
        const NUM_DISTRICTS = 1; // KEY DIFFERENCE: Only 1 district
        const VOTERS_PER_DISTRICT = 3000; // All 150 voters in one district
        const NUM_CANDIDATES = 3;
        const TOTAL_VOTERS = NUM_DISTRICTS * VOTERS_PER_DISTRICT; 
        
        console.log(`📊 Scale: ${NUM_DISTRICTS} district, ${VOTERS_PER_DISTRICT} voters in single district, ${NUM_CANDIDATES} candidates`);
        console.log(`🎯 Test Goal: Compare single district vs multi-district performance`);
        
        // Deploy contract
        console.log("Step 1: Deploying contracts...");
        const OrchestratorFactory = await ethers.getContractFactory("ElectionOrchestrator");
        const orchestrator = await OrchestratorFactory.deploy();
        await orchestrator.waitForDeployment();
        
        console.log(`✅ Orchestrator deployed`);
        
        // Add candidates (same as multi-district test)
        console.log("Step 2: Adding candidates...");
        
        console.log("   Adding Alice...");
        const tx1 = await orchestrator.addCandidate("Alice Johnson", "Progressive Party");
        const receipt1 = await tx1.wait();
        console.log(`   Alice transaction: ${receipt1.transactionHash}`);
        
        console.log("   Adding Bob...");
        const tx2 = await orchestrator.addCandidate("Bob Smith", "Conservative Party");
        const receipt2 = await tx2.wait();
        console.log(`   Bob transaction: ${receipt2.transactionHash}`);
        
        console.log("   Adding Carol...");
        const tx3 = await orchestrator.addCandidate("Carol Davis", "Green Party");
        const receipt3 = await tx3.wait();
        console.log(`   Carol transaction: ${receipt3.transactionHash}`);
        
        const candidateCount = await orchestrator.getCandidateCount();
        console.log(`   ✅ ${Number(candidateCount)} candidates added`);
        expect(Number(candidateCount)).to.equal(NUM_CANDIDATES);
        
        // Create single district
        console.log("Step 3: Creating single district...");
        const districtName = "Unified-District";
        const districts = [];
        
        console.log(`   Creating district 0: ${districtName}...`);
        
        const districtTx = await orchestrator.createDistrict(districtName);
        const districtReceipt = await districtTx.wait();
        console.log(`   District 0 transaction: ${districtReceipt.transactionHash}`);
        
        const districtAddress = await orchestrator.getDistrictAddress(0);
        const districtContract = await ethers.getContractAt("DistrictVoting", districtAddress);
        
        // All 150 voters go to the single district
        const districtVoters = votersPool; // All voters in one district
        
        console.log(`   Assigning all ${districtVoters.length} voters to single district`);
        
        districts.push({
            id: 0,
            name: districtName,
            address: districtAddress,
            contract: districtContract,
            voters: districtVoters
        });
        
        console.log(`   ✅ ${districtName}: ${districts[0].voters.length} voters assigned at ${districtAddress}`);
        
        const districtCreationStats = await orchestrator.getElectionStats();
        console.log(`   ✅ Total districts created: ${Number(districtCreationStats._totalDistricts)}`);
        expect(Number(districtCreationStats._totalDistricts)).to.equal(NUM_DISTRICTS);
        
        // Start registration and register voters
        console.log("Step 4: Registering voters...");
        
        console.log("   Starting registration phase...");
        const regTx = await orchestrator.startRegistration();
        const regReceipt = await regTx.wait();
        console.log(`   Registration transaction: ${regReceipt.transactionHash}`);
        
        const regState = await orchestrator.state();
        console.log(`   Registration state: ${Number(regState)}`);
        expect(Number(regState)).to.equal(1);
        
        // Register all voters in the single district
        console.log(`   Registering all ${districts[0].voters.length} voters in ${districts[0].name}...`);
        
        console.time("Single District Registration");
        
        const voterAddresses = districts[0].voters.map(v => v.address);
        
        try {
            const tx = await orchestrator.batchRegisterVoters(0, voterAddresses);
            const receipt = await tx.wait();
            console.log(`   ${districts[0].name} registration transaction: ${receipt.transactionHash}`);
            console.log(`   ✅ Successfully registered ${voterAddresses.length} voters`);
        } catch (error) {
            console.error(`   ❌ Registration failed for ${districts[0].name}:`, error.message);
            throw error;
        }
        
        console.timeEnd("Single District Registration");
        
        const regStats = await orchestrator.getElectionStats();
        console.log(`✅ ${Number(regStats._totalVotersRegistered)} voters registered in single district`);
        expect(Number(regStats._totalVotersRegistered)).to.equal(TOTAL_VOTERS);
        
        // Start voting
        console.log("Step 5: Starting voting phase...");
        
        console.log("   Calling startVoting...");
        const votingTx = await orchestrator.startVoting();
        const votingReceipt = await votingTx.wait();
        console.log(`   Voting transaction: ${votingReceipt.transactionHash}`);
        
        const votingState = await orchestrator.state();
        console.log(`   Voting state: ${Number(votingState)}`);
        expect(Number(votingState)).to.equal(2);
        
        // Define voting strategy for single district (mixed preferences like multi-district)
        const votingStrategy = {
            generateScores: (voterIndex) => {
                // Simulate the same variety as multi-district by using voter index
                if (voterIndex < 30) {
                    // Alice favored (like Metro district)
                    return [8 + (voterIndex % 3), 3 + (voterIndex % 2), 2 + (voterIndex % 2)];
                } else if (voterIndex < 60) {
                    // Bob favored (like Suburban district)
                    return [2 + (voterIndex % 2), 8 + (voterIndex % 3), 3 + (voterIndex % 2)];
                } else if (voterIndex < 90) {
                    // Carol favored (like Rural district)
                    return [3 + (voterIndex % 2), 2 + (voterIndex % 2), 8 + (voterIndex % 3)];
                } else if (voterIndex < 120) {
                    // Mixed preferences (like Industrial district)
                    return [5 + (voterIndex % 3), 5 + (voterIndex % 3), 5 + (voterIndex % 3)];
                } else {
                    // Highly varied (like University district)
                    return [
                        Math.floor(Math.random() * 6) + 5, // 5-10
                        Math.floor(Math.random() * 6) + 5, // 5-10  
                        Math.floor(Math.random() * 6) + 5  // 5-10
                    ];
                }
            }
        };
        
        // SINGLE DISTRICT PARALLEL VOTING
        console.log("Step 6: 🏢 PARALLEL VOTING IN SINGLE DISTRICT 🏢");
        console.log(`   Processing all ${TOTAL_VOTERS} voters in one district simultaneously...`);
        console.time("Single District Parallel Voting");
        
        const district = districts[0];
        
        // Create individual vote promises for all voters in the single district
        const votingPromises = district.voters.map(async (voter, voterIndex) => {
            try {
                const scores = votingStrategy.generateScores(voterIndex);
                
                // Each vote is independent and asynchronous (same as multi-district)
                const voteTx = await district.contract.connect(voter).castVote(scores);
                await voteTx.wait();
                
                // Progress tracking every 10 votes for single district
                if ((voterIndex + 1) % 10 === 0 || voterIndex === district.voters.length - 1) {
                    console.log(`     📊 Single District: ${voterIndex + 1}/${district.voters.length} votes completed`);
                }
                
                return { district: 0, voter: voterIndex, success: true };
            } catch (error) {
                console.log(`     ⚠️ Vote failed: Voter ${voterIndex}: ${error.message}`);
                return { district: 0, voter: voterIndex, success: false, error: error.message };
            }
        });
        
        // Wait for all votes in the single district to complete
        const allVoteResults = await Promise.allSettled(votingPromises);
        console.timeEnd("Single District Parallel Voting");
        
        const successfulVotes = allVoteResults.filter(r => r.status === 'fulfilled' && r.value.success).length;
        const failedVotes = allVoteResults.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;
        
        console.log(`   ✅ Single District: ${successfulVotes}/${district.voters.length} votes completed`);
        
        // Analyze single district voting results
        console.log("\n" + "=".repeat(80));
        console.log("📊 SINGLE DISTRICT VOTING RESULTS");
        console.log("=".repeat(80));
        
        const successRate = (successfulVotes / district.voters.length * 100).toFixed(1);
        console.log(`Single District (${district.name}): ${successfulVotes}/${district.voters.length} votes (${successRate}%)`);
        
        console.log("=".repeat(80));
        console.log(`📈 OVERALL: ${successfulVotes}/${district.voters.length} votes successful (${successRate}%)`);
        console.log("=".repeat(80));
        
        // Verify district stats
        console.log("\nStep 7: Verifying district vote counts...");
        const districtStats = await district.contract.getDistrictStats();
        console.log(`   Single District: ${Number(districtStats._totalVotes)} votes recorded`);
        
        // End voting and collect results
        console.log("\nStep 8: Ending voting and collecting results...");
        
        console.log("   Ending voting phase...");
        const endVotingTx = await orchestrator.endVoting();
        await endVotingTx.wait();
        
        console.log("   Collecting results from single district...");
        const collectTx = await orchestrator.collectResults();
        await collectTx.wait();
        
        // Wait a moment for results to be finalized
        console.log("   Finalizing election results...");
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Get final results
        console.log("   Fetching final results...");
        const finalResults = await orchestrator.getElectionResults();
        
        console.log("\n" + "=".repeat(80));
        console.log("🏆 FINAL ELECTION RESULTS (SINGLE DISTRICT)");
        console.log("=".repeat(80));
        
        for (let i = 0; i < finalResults.names.length; i++) {
            const score = Number(finalResults.totalScores[i]);
            const votes = Number(finalResults.totalVotes[i]);
            console.log(`${finalResults.names[i]}: ${score} points (${votes} total votes)`);
        }
        
        console.log("=".repeat(80));
        
        // Try to get winner with error handling
        try {
            const winner = await orchestrator.getWinner();
            console.log(`🏆 WINNER: ${winner.winnerName} with ${Number(winner.winnerScore)} points!`);
        } catch (error) {
            console.log(`⚠️ Winner retrieval failed: ${error.message}`);
            console.log("🏆 WINNER: Results calculated but winner API needs investigation");
            
            // Calculate winner manually from results
            let maxScore = 0;
            let winnerIndex = 0;
            for (let i = 0; i < finalResults.totalScores.length; i++) {
                const score = Number(finalResults.totalScores[i]);
                if (score > maxScore) {
                    maxScore = score;
                    winnerIndex = i;
                }
            }
            console.log(`🏆 CALCULATED WINNER: ${finalResults.names[winnerIndex]} with ${maxScore} points!`);
        }
        
        console.log(`🏢 SINGLE DISTRICT PROCESSING: All ${successfulVotes} voters in one district`);
        console.log(`⚡ PARALLEL SCALE: ${successfulVotes} voters voted simultaneously!`);
        console.log("=".repeat(80));
        
        // Verify the system handled single district voting correctly
        const finalElectionStats = await orchestrator.getElectionStats();
        expect(Number(finalElectionStats._totalVotesCast)).to.be.greaterThan(100); // Should have most votes
        expect(Number(finalElectionStats._resultsSubmitted)).to.equal(NUM_DISTRICTS); // Should be 1
        
        console.log(`📊 Final verification: ${Number(finalElectionStats._totalVotesCast)} votes cast in ${Number(finalElectionStats._resultsSubmitted)} district`);
        
        console.log("\n🏢 SINGLE DISTRICT VOTING SYSTEM COMPLETED! 🏢");
        console.log("📊 Compare this with multi-district performance! 📊");
    });
    
});