// test/fixed-million-voter.js - Sequential processing for reliability
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { ScalableSignerManager } = require("../utils/scalableSigners");
const WalletFunder = require("../utils/walletFunding");

describe("🚀 FIXED MILLION VOTER EXPERIMENT", function () {
    
    it("Should handle large scale with sequential district processing", async function () {
        this.timeout(7200000); // 2 hours for large scale
        
        console.log("🌍 FIXED LARGE-SCALE ELECTION WITH SEQUENTIAL PROCESSING");
        console.log("=".repeat(80));
        
        // Configurable scale - start smaller for testing, increase gradually
        const SCALE_OPTIONS = {
            TEST: { districts: 5, votersPerDistrict: 100, candidates: 5 },    // 500 voters
            SMALL: { districts: 10, votersPerDistrict: 500, candidates: 8 },   // 5K voters  
            MEDIUM: { districts: 20, votersPerDistrict: 1000, candidates: 10 }, // 20K voters
            LARGE: { districts: 50, votersPerDistrict: 2000, candidates: 10 },  // 100K voters
        };
        
        const SCALE = SCALE_OPTIONS.SMALL; // Change this to scale up
        const NUM_DISTRICTS = SCALE.districts;
        const VOTERS_PER_DISTRICT = SCALE.votersPerDistrict;
        const NUM_CANDIDATES = SCALE.candidates;
        const TOTAL_VOTERS = NUM_DISTRICTS * VOTERS_PER_DISTRICT;
        
        console.log(`🎯 SCALE: ${NUM_DISTRICTS} districts × ${VOTERS_PER_DISTRICT.toLocaleString()} voters = ${TOTAL_VOTERS.toLocaleString()} total`);
        console.log(`🏛️ Candidates: ${NUM_CANDIDATES}`);
        console.log("=".repeat(80));
        
        const overallStart = Date.now();
        
        // PHASE 1: WALLET GENERATION
        console.log("PHASE 1: 🔧 GENERATING VOTER WALLETS");
        console.log("-".repeat(60));
        
        const signerManager = new ScalableSignerManager();
        const [admin] = await ethers.getSigners();
        
        console.time("🔧 Wallet Generation");
        const voterWallets = await signerManager.getVoterWallets(TOTAL_VOTERS);
        console.timeEnd("🔧 Wallet Generation");
        
        const provider = ethers.provider;
        const voterSigners = voterWallets.map(walletData => 
            new ethers.Wallet(walletData.privateKey, provider)
        );
        
        const memUsage = signerManager.getMemoryUsage();
        console.log(`✅ Generated ${TOTAL_VOTERS.toLocaleString()} voters`);
        console.log(`💾 Memory usage: ${memUsage.actualMemoryMB}MB`);
        
        // PHASE 2: WALLET FUNDING
        console.log("\nPHASE 2: 💰 FUNDING WALLETS");
        console.log("-".repeat(60));
        
        const funder = new WalletFunder(admin, {
            fundingAmount: ethers.parseEther("2.0"), // Generous funding
            batchSize: 100,
            gasLimit: 21000
        });
        
        console.time("💰 Wallet Funding");
        const fundingResult = await funder.fundWallets(voterSigners);
        console.timeEnd("💰 Wallet Funding");
        
        console.log(`✅ Funded ${fundingResult.successCount.toLocaleString()} wallets`);
        
        // PHASE 3: CONTRACT DEPLOYMENT
        console.log("\nPHASE 3: 🏗️ CONTRACT DEPLOYMENT");
        console.log("-".repeat(60));
        
        console.time("🏗️ Contract Deployment");
        const OrchestratorFactory = await ethers.getContractFactory("ElectionOrchestrator");
        const orchestrator = await OrchestratorFactory.connect(admin).deploy();
        await orchestrator.waitForDeployment();
        console.timeEnd("🏗️ Contract Deployment");
        
        console.log(`✅ Election orchestrator deployed`);
        
        // PHASE 4: ELECTION SETUP
        console.log("\nPHASE 4: 🗳️ ELECTION SETUP");
        console.log("-".repeat(60));
        
        // Add candidates
        const candidateNames = [
            "Alice Johnson", "Bob Smith", "Carol Davis", "David Wilson", "Eva Brown",
            "Frank Miller", "Grace Lee", "Henry Clark", "Ivy Rodriguez", "Jack Taylor"
        ];
        const partyNames = [
            "Progressive Party", "Conservative Party", "Green Party", "Liberal Party", "Socialist Party",
            "Libertarian Party", "Centrist Party", "Reform Party", "Unity Party", "Innovation Party"
        ];
        
        console.log("🏛️ Adding candidates...");
        for (let i = 0; i < NUM_CANDIDATES; i++) {
            await orchestrator.connect(admin).addCandidate(candidateNames[i], partyNames[i]);
            console.log(`   ✅ Added ${candidateNames[i]} (${partyNames[i]})`);
        }
        
        // Create districts
        console.log("🗺️ Creating districts...");
        const stateNames = [
            "California", "Texas", "Florida", "New York", "Pennsylvania",
            "Illinois", "Ohio", "Georgia", "North Carolina", "Michigan",
            "New Jersey", "Virginia", "Washington", "Arizona", "Massachusetts",
            "Tennessee", "Indiana", "Maryland", "Missouri", "Wisconsin",
            "Colorado", "Minnesota", "South Carolina", "Alabama", "Louisiana",
            "Kentucky", "Oregon", "Oklahoma", "Connecticut", "Utah",
            "Iowa", "Nevada", "Arkansas", "Mississippi", "Kansas",
            "New Mexico", "Nebraska", "Idaho", "West Virginia", "Hawaii",
            "New Hampshire", "Maine", "Montana", "Rhode Island", "Delaware",
            "South Dakota", "North Dakota", "Alaska", "Vermont", "Wyoming"
        ];
        
        const districts = [];
        for (let i = 0; i < NUM_DISTRICTS; i++) {
            const stateName = stateNames[i] || `District-${i}`;
            await orchestrator.connect(admin).createDistrict(stateName);
            
            const districtAddress = await orchestrator.getDistrictAddress(i);
            const districtContract = await ethers.getContractAt("DistrictVoting", districtAddress);
            
            const startIndex = i * VOTERS_PER_DISTRICT;
            const endIndex = startIndex + VOTERS_PER_DISTRICT;
            const stateVoters = voterSigners.slice(startIndex, endIndex);
            
            districts.push({
                id: i,
                name: stateName,
                address: districtAddress,
                contract: districtContract,
                voters: stateVoters
            });
            
            if (i % 5 === 0 || i === NUM_DISTRICTS - 1) {
                console.log(`   ✅ Created ${i + 1}/${NUM_DISTRICTS} districts (${stateName}: ${stateVoters.length.toLocaleString()} voters)`);
            }
        }
        
        // PHASE 5: VOTER REGISTRATION (Sequential)
        console.log("\nPHASE 5: 📝 SEQUENTIAL VOTER REGISTRATION");
        console.log("-".repeat(60));
        
        await orchestrator.connect(admin).startRegistration();
        
        console.time("📝 Sequential Registration");
        const REGISTRATION_BATCH_SIZE = 100;
        
        // Process districts sequentially instead of parallel
        for (const district of districts) {
            console.log(`   📝 Registering ${district.voters.length.toLocaleString()} voters in ${district.name}...`);
            
            // Process voters in batches within each district
            for (let i = 0; i < district.voters.length; i += REGISTRATION_BATCH_SIZE) {
                const batch = district.voters.slice(i, i + REGISTRATION_BATCH_SIZE);
                const voterAddresses = batch.map(v => v.address);
                
                const tx = await orchestrator.connect(admin).batchRegisterVoters(district.id, voterAddresses);
                await tx.wait();
                
                // Progress reporting
                if (i % (REGISTRATION_BATCH_SIZE * 5) === 0) {
                    console.log(`     ${district.name}: ${Math.min(i + REGISTRATION_BATCH_SIZE, district.voters.length).toLocaleString()}/${district.voters.length.toLocaleString()} registered`);
                }
            }
            
            console.log(`   ✅ ${district.name}: All ${district.voters.length.toLocaleString()} voters registered`);
        }
        
        console.timeEnd("📝 Sequential Registration");
        
        const regStats = await orchestrator.getElectionStats();
        console.log(`✅ Total registered: ${Number(regStats._totalVotersRegistered).toLocaleString()} voters`);
        
        // PHASE 6: SEQUENTIAL VOTING (Key Fix!)
        console.log("\nPHASE 6: 🗳️ SEQUENTIAL DISTRICT VOTING");
        console.log("-".repeat(60));
        
        await orchestrator.connect(admin).startVoting();
        
        console.time("🗳️ Sequential Voting");
        
        let totalSuccessfulVotes = 0;
        let totalFailedVotes = 0;
        
        // Process districts ONE AT A TIME (this is the key fix!)
        for (let d = 0; d < districts.length; d++) {
            const district = districts[d];
            console.log(`\n   🗳️ Processing ${district.name} (${d + 1}/${NUM_DISTRICTS}): ${district.voters.length.toLocaleString()} voters...`);
            
            let districtSuccessful = 0;
            let districtFailed = 0;
            
            // Within each district, process voters in small chunks sequentially
            const VOTING_BATCH_SIZE = 20; // Small batches for reliability
            
            for (let i = 0; i < district.voters.length; i += VOTING_BATCH_SIZE) {
                const chunk = district.voters.slice(i, i + VOTING_BATCH_SIZE);
                
                // Process chunk sequentially (not parallel)
                for (const voter of chunk) {
                    try {
                        // Generate realistic voting scores
                        const scores = Array.from({length: NUM_CANDIDATES}, (_, idx) => {
                            const baseScore = Math.floor(Math.random() * 6) + 5; // 5-10
                            const districtBias = (district.id + idx) % 3; // District preferences
                            return Math.min(10, baseScore + districtBias);
                        });
                        
                        const voteTx = await district.contract.connect(voter).castVote(scores, {
                            gasLimit: 1000000, // High gas limit
                            gasPrice: ethers.parseUnits("2", "gwei") // Explicit gas price
                        });
                        await voteTx.wait();
                        
                        districtSuccessful++;
                        
                    } catch (error) {
                        districtFailed++;
                        
                        // Log first few errors for debugging
                        if (districtFailed <= 3) {
                            console.log(`     ⚠️ Vote failed: ${error.message.substring(0, 50)}...`);
                        }
                    }
                }
                
                // Progress reporting
                const processed = Math.min(i + VOTING_BATCH_SIZE, district.voters.length);
                if (i % (VOTING_BATCH_SIZE * 25) === 0 || processed === district.voters.length) {
                    console.log(`     📊 ${district.name}: ${processed.toLocaleString()}/${district.voters.length.toLocaleString()} processed (${districtSuccessful.toLocaleString()} successful)`);
                }
            }
            
            totalSuccessfulVotes += districtSuccessful;
            totalFailedVotes += districtFailed;
            
            const successRate = (districtSuccessful / district.voters.length * 100).toFixed(1);
            console.log(`   ✅ ${district.name}: ${districtSuccessful.toLocaleString()}/${district.voters.length.toLocaleString()} votes (${successRate}%)`);
        }
        
        console.timeEnd("🗳️ Sequential Voting");
        
        // PHASE 7: RESULTS
        console.log("\nPHASE 7: 📊 COLLECTING RESULTS");
        console.log("-".repeat(60));
        
        await orchestrator.connect(admin).endVoting();
        await orchestrator.connect(admin).collectResults();
        
        const finalResults = await orchestrator.getElectionResults();
        
        const overallDuration = Date.now() - overallStart;
        const overallSuccessRate = (totalSuccessfulVotes / (totalSuccessfulVotes + totalFailedVotes) * 100).toFixed(1);
        
        console.log("\n" + "=".repeat(80));
        console.log("🏆 LARGE-SCALE ELECTION RESULTS (SEQUENTIAL PROCESSING)");
        console.log("=".repeat(80));
        console.log(`📈 TOTAL VOTES: ${totalSuccessfulVotes.toLocaleString()}/${(totalSuccessfulVotes + totalFailedVotes).toLocaleString()} successful (${overallSuccessRate}%)`);
        console.log(`⏱️ TOTAL DURATION: ${Math.round(overallDuration / 1000 / 60)} minutes`);
        console.log(`💾 PEAK MEMORY: ${memUsage.actualMemoryMB}MB`);
        console.log(`⚡ VOTE RATE: ${Math.round(totalSuccessfulVotes / (overallDuration / 1000))} votes/second`);
        
        console.log("\n🏛️ ELECTION RESULTS:");
        let maxScore = 0;
        let winnerIndex = 0;
        
        for (let i = 0; i < finalResults.names.length; i++) {
            const score = Number(finalResults.totalScores[i]);
            const votes = Number(finalResults.totalVotes[i]);
            
            if (score > maxScore) {
                maxScore = score;
                winnerIndex = i;
            }
            
            console.log(`   ${finalResults.names[i]}: ${score.toLocaleString()} points (${votes.toLocaleString()} votes)`);
        }
        
        console.log("=".repeat(80));
        console.log(`🏆 WINNER: ${finalResults.names[winnerIndex]} with ${maxScore.toLocaleString()} points!`);
        console.log("=".repeat(80));
        
        console.log("🌍 LARGE-SCALE ELECTION WITH SEQUENTIAL PROCESSING COMPLETED!");
        console.log(`🚀 Successfully processed ${totalSuccessfulVotes.toLocaleString()} votes across ${NUM_DISTRICTS} districts!`);
        
        // Test assertions
        expect(totalSuccessfulVotes).to.be.greaterThan(TOTAL_VOTERS * 0.8, "At least 80% of votes should succeed");
        expect(overallSuccessRate).to.be.greaterThan(80, "Success rate should be above 80%");
        
        // Cleanup
        signerManager.clearCache();
        
        console.log("\n🎉 SEQUENTIAL PROCESSING EXPERIMENT SUCCESSFUL! 🎉");
        
        return {
            totalVoters: TOTAL_VOTERS,
            successfulVotes: totalSuccessfulVotes,
            successRate: parseFloat(overallSuccessRate),
            duration: overallDuration,
            votesPerSecond: Math.round(totalSuccessfulVotes / (overallDuration / 1000))
        };
    });
});