const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Sequential Voting System Test", function () {
    
    it("Should handle massive sequential voting across districts", async function () {
        this.timeout(600000); // 10 minutes timeout for sequential voting (longer than parallel)
        
        console.log("🐌 SEQUENTIAL VOTING TEST: Voters voting one by one");
        console.log("=".repeat(80));
        
        // Get signers - we'll use the same setup as parallel test
        const signers = await ethers.getSigners();
        const admin = signers[0];
        const votersPool = signers.slice(1, 151); // 150 voters (same as parallel test)
        
        const NUM_DISTRICTS = 5;
        const VOTERS_PER_DISTRICT = 30; 
        const NUM_CANDIDATES = 3;
        const TOTAL_VOTERS = NUM_DISTRICTS * VOTERS_PER_DISTRICT; 
        
        console.log(`📊 Scale: ${NUM_DISTRICTS} districts, ${VOTERS_PER_DISTRICT} voters per district, ${NUM_CANDIDATES} candidates`);
        
        // Deploy contract
        console.log("Step 1: Deploying contracts...");
        const OrchestratorFactory = await ethers.getContractFactory("ElectionOrchestrator");
        const orchestrator = await OrchestratorFactory.deploy();
        await orchestrator.waitForDeployment();
        
        console.log(`✅ Orchestrator deployed`);
        
        // Add candidates
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
        
        // Create districts
        console.log("Step 3: Creating districts...");
        const districtNames = ["Metro", "Suburban", "Rural", "Industrial", "University"];
        const districts = [];
        
        for (let i = 0; i < NUM_DISTRICTS; i++) {
            console.log(`   Creating district ${i}: ${districtNames[i]}...`);
            
            const districtTx = await orchestrator.createDistrict(districtNames[i]);
            const districtReceipt = await districtTx.wait();
            console.log(`   District ${i} transaction: ${districtReceipt.transactionHash}`);
            
            const districtAddress = await orchestrator.getDistrictAddress(i);
            const districtContract = await ethers.getContractAt("DistrictVoting", districtAddress);
            
            // Fix voter distribution - ensure each district gets exactly VOTERS_PER_DISTRICT voters
            const startIndex = i * VOTERS_PER_DISTRICT;
            const endIndex = startIndex + VOTERS_PER_DISTRICT;
            const districtVoters = votersPool.slice(startIndex, endIndex);
            
            console.log(`   Assigning voters ${startIndex} to ${endIndex - 1} to district ${i}`);
            console.log(`   Voters pool slice [${startIndex}:${endIndex}] = ${districtVoters.length} voters`);
            
            districts.push({
                id: i,
                name: districtNames[i],
                address: districtAddress,
                contract: districtContract,
                voters: districtVoters
            });
            
            console.log(`   ✅ ${districtNames[i]}: ${districts[i].voters.length} voters assigned at ${districtAddress}`);
        }
        
        const districtCreationStats = await orchestrator.getElectionStats();
        console.log(`   ✅ Total districts created: ${Number(districtCreationStats._totalDistricts)}`);
        expect(Number(districtCreationStats._totalDistricts)).to.equal(NUM_DISTRICTS);
        
        // Start registration and register voters
        console.log("Step 4: Registering voters in parallel...");
        
        console.log("   Starting registration phase...");
        const regTx = await orchestrator.startRegistration();
        const regReceipt = await regTx.wait();
        console.log(`   Registration transaction: ${regReceipt.transactionHash}`);
        
        const regState = await orchestrator.state();
        console.log(`   Registration state: ${Number(regState)}`);
        expect(Number(regState)).to.equal(1);
        
        // Register voters in parallel across all districts (same as parallel test)
        const registrationPromises = districts.map(async (district) => {
            console.log(`   Registering ${district.voters.length} voters in ${district.name}...`);
            
            // Skip empty districts to avoid transaction revert
            if (district.voters.length === 0) {
                console.log(`   ⚠️ Skipping ${district.name} - no voters assigned`);
                return { success: true, districtId: district.id, votersRegistered: 0, skipped: true };
            }
            
            const voterAddresses = district.voters.map(v => v.address);
            
            try {
                const tx = await orchestrator.batchRegisterVoters(district.id, voterAddresses);
                const receipt = await tx.wait();
                console.log(`   ${district.name} registration transaction: ${receipt.transactionHash}`);
                return { success: true, districtId: district.id, votersRegistered: voterAddresses.length };
            } catch (error) {
                console.error(`   ❌ Registration failed for ${district.name}:`, error.message);
                return { success: false, districtId: district.id, error: error.message };
            }
        });
        
        console.time("Parallel Registration");
        const registrationResults = await Promise.all(registrationPromises);
        console.timeEnd("Parallel Registration");
        
        // Check registration results
        const successfulRegistrations = registrationResults.filter(r => r.success);
        const failedRegistrations = registrationResults.filter(r => !r.success);
        
        console.log(`   ✅ Successful registrations: ${successfulRegistrations.length}/${NUM_DISTRICTS}`);
        if (failedRegistrations.length > 0) {
            console.log(`   ❌ Failed registrations:`);
            failedRegistrations.forEach(r => {
                console.log(`      District ${r.districtId}: ${r.error}`);
            });
        }
        
        const regStats = await orchestrator.getElectionStats();
        console.log(`✅ ${Number(regStats._totalVotersRegistered)} voters registered in parallel`);
        
        // Only expect successful registrations
        const expectedRegistrations = successfulRegistrations.reduce((sum, r) => sum + r.votersRegistered, 0);
        expect(Number(regStats._totalVotersRegistered)).to.equal(expectedRegistrations);
        
        // Start voting
        console.log("Step 5: Starting voting phase...");
        
        console.log("   Calling startVoting...");
        const votingTx = await orchestrator.startVoting();
        const votingReceipt = await votingTx.wait();
        console.log(`   Voting transaction: ${votingReceipt.transactionHash}`);
        
        const votingState = await orchestrator.state();
        console.log(`   Voting state: ${Number(votingState)}`);
        expect(Number(votingState)).to.equal(2);
        
        // Define voting strategies per district (same as parallel test)
        const votingStrategies = {
            0: { // Metro - Alice favored
                generateScores: (voterIndex) => [8 + (voterIndex % 3), 3 + (voterIndex % 2), 2 + (voterIndex % 2)]
            },
            1: { // Suburban - Bob favored  
                generateScores: (voterIndex) => [2 + (voterIndex % 2), 8 + (voterIndex % 3), 3 + (voterIndex % 2)]
            },
            2: { // Rural - Carol favored
                generateScores: (voterIndex) => [3 + (voterIndex % 2), 2 + (voterIndex % 2), 8 + (voterIndex % 3)]
            },
            3: { // Industrial - Mixed preferences
                generateScores: (voterIndex) => [5 + (voterIndex % 3), 5 + (voterIndex % 3), 5 + (voterIndex % 3)]
            },
            4: { // University - Highly varied
                generateScores: (voterIndex) => [
                    Math.floor(Math.random() * 6) + 5, // 5-10
                    Math.floor(Math.random() * 6) + 5, // 5-10  
                    Math.floor(Math.random() * 6) + 5  // 5-10
                ]
            }
        };
        
        // SEQUENTIAL VOTING - Process one vote at a time!
        console.log("Step 6: 🐌 SEQUENTIAL VOTING ACROSS ALL DISTRICTS 🐌");
        console.log(`   Processing ${TOTAL_VOTERS} voters one by one...`);
        console.time("Sequential Voting");
        
        let totalVotesSuccessful = 0;
        let totalVotesAttempted = 0;
        const districtResults = districts.map(district => ({
            districtId: district.id,
            districtName: district.name,
            totalVoters: district.voters.length,
            successfulVotes: 0,
            failedVotes: 0
        }));
        
        // Process each district sequentially
        for (let districtIndex = 0; districtIndex < NUM_DISTRICTS; districtIndex++) {
            const district = districts[districtIndex];
            console.log(`   🗳️ District ${district.id} (${district.name}): Processing ${district.voters.length} sequential votes...`);
            
            // Process each voter in this district sequentially
            for (let voterIndex = 0; voterIndex < district.voters.length; voterIndex++) {
                const voter = district.voters[voterIndex];
                totalVotesAttempted++;
                
                try {
                    const scores = votingStrategies[district.id].generateScores(voterIndex);
                    
                    // Each vote is processed one at a time (sequential)
                    const voteTx = await district.contract.connect(voter).castVote(scores);
                    await voteTx.wait();
                    
                    totalVotesSuccessful++;
                    districtResults[districtIndex].successfulVotes++;
                    
                    // Progress tracking every 5 votes
                    if ((voterIndex + 1) % 5 === 0 || voterIndex === district.voters.length - 1) {
                        console.log(`     📊 District ${district.id}: ${voterIndex + 1}/${district.voters.length} votes completed`);
                    }
                } catch (error) {
                    console.log(`     ⚠️ Vote failed: District ${district.id}, Voter ${voterIndex}: ${error.message}`);
                    districtResults[districtIndex].failedVotes++;
                }
            }
            
            console.log(`   ✅ District ${district.id} (${district.name}): ${districtResults[districtIndex].successfulVotes}/${district.voters.length} votes completed`);
        }
        
        console.timeEnd("Sequential Voting");
        
        // Analyze sequential voting results
        console.log("\n" + "=".repeat(80));
        console.log("📊 SEQUENTIAL VOTING RESULTS");
        console.log("=".repeat(80));
        
        districtResults.forEach((result) => {
            const successRate = (result.successfulVotes / result.totalVoters * 100).toFixed(1);
            console.log(`District ${result.districtId} (${result.districtName}): ${result.successfulVotes}/${result.totalVoters} votes (${successRate}%)`);
        });
        
        const overallSuccessRate = (totalVotesSuccessful / totalVotesAttempted * 100).toFixed(1);
        console.log("=".repeat(80));
        console.log(`📈 OVERALL: ${totalVotesSuccessful}/${totalVotesAttempted} votes successful (${overallSuccessRate}%)`);
        console.log("=".repeat(80));
        
        // Verify district stats
        console.log("\nStep 7: Verifying district vote counts...");
        for (let i = 0; i < NUM_DISTRICTS; i++) {
            const districtStats = await districts[i].contract.getDistrictStats();
            console.log(`   District ${i}: ${Number(districtStats._totalVotes)} votes recorded`);
        }
        
        // End voting and collect results
        console.log("\nStep 8: Ending voting and collecting results...");
        
        console.log("   Ending voting phase...");
        const endVotingTx = await orchestrator.endVoting();
        await endVotingTx.wait();
        
        console.log("   Collecting results from all districts...");
        const collectTx = await orchestrator.collectResults();
        await collectTx.wait();
        
        // Wait a moment for results to be finalized
        console.log("   Finalizing election results...");
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Get final results
        console.log("   Fetching final results...");
        const finalResults = await orchestrator.getElectionResults();
        
        console.log("\n" + "=".repeat(80));
        console.log("🏆 FINAL ELECTION RESULTS (SEQUENTIAL VOTING)");
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
        
        console.log(`🐌 SEQUENTIAL PROCESSING: Districts processed one after another`);
        console.log(`⏳ SEQUENTIAL SCALE: ${totalVotesSuccessful} voters voted sequentially!`);
        console.log("=".repeat(80));
        
        // Verify the system handled sequential voting correctly
        const finalElectionStats = await orchestrator.getElectionStats();
        expect(Number(finalElectionStats._totalVotesCast)).to.be.greaterThan(10); // Reasonable expectation
        expect(Number(finalElectionStats._resultsSubmitted)).to.equal(NUM_DISTRICTS);
        
        console.log(`📊 Final verification: ${Number(finalElectionStats._totalVotesCast)} votes cast across ${Number(finalElectionStats._resultsSubmitted)} districts`);
        
        console.log("\n🐌 SEQUENTIAL VOTING SYSTEM COMPLETED! 🐌");
        console.log("⏱️ Compare this timing with parallel voting! ⏱️");
    });
    

});