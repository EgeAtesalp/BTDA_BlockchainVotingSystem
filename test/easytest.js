// test/voting-diagnostic.js - Debug why votes are failing
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { ScalableSignerManager } = require("../utils/scalableSigners");
const WalletFunder = require("../utils/walletFunding");

describe("🔍 Voting Failure Diagnostic", function () {
    
    it("Should diagnose why votes are failing at scale", async function () {
        this.timeout(600000); // 10 minutes
        
        console.log("🔍 DIAGNOSTIC: Investigating voting failures");
        console.log("=".repeat(60));
        
        // Start with a very small, controlled test
        const NUM_DISTRICTS = 2;
        const VOTERS_PER_DISTRICT = 5;
        const TOTAL_VOTERS = NUM_DISTRICTS * VOTERS_PER_DISTRICT;
        
        console.log(`🧪 Testing with minimal scale: ${NUM_DISTRICTS} districts × ${VOTERS_PER_DISTRICT} voters = ${TOTAL_VOTERS} total`);
        
        // Step 1: Generate and fund voters
        console.log("\nStep 1: 🔧 Generate and fund voters");
        const signerManager = new ScalableSignerManager();
        const [admin] = await ethers.getSigners();
        
        const voterWallets = await signerManager.getVoterWallets(TOTAL_VOTERS);
        const provider = ethers.provider;
        const voterSigners = voterWallets.map(walletData => 
            new ethers.Wallet(walletData.privateKey, provider)
        );
        
        const funder = new WalletFunder(admin, {
            fundingAmount: ethers.parseEther("2.0"), // Even more ETH
            batchSize: 10
        });
        
        const fundingResult = await funder.fundWallets(voterSigners);
        console.log(`✅ Funded ${fundingResult.successCount}/${TOTAL_VOTERS} wallets`);
        
        // Verify funding worked
        for (let i = 0; i < 3; i++) {
            const balance = await provider.getBalance(voterSigners[i].address);
            console.log(`   Voter ${i} balance: ${ethers.formatEther(balance)} ETH`);
            
            if (balance < ethers.parseEther("1.0")) {
                throw new Error(`Voter ${i} has insufficient balance: ${ethers.formatEther(balance)} ETH`);
            }
        }
        
        // Step 2: Deploy and setup contracts
        console.log("\nStep 2: 🏗️ Deploy and setup contracts");
        const OrchestratorFactory = await ethers.getContractFactory("ElectionOrchestrator");
        const orchestrator = await OrchestratorFactory.connect(admin).deploy();
        await orchestrator.waitForDeployment();
        
        console.log(`✅ Orchestrator deployed at ${await orchestrator.getAddress()}`);
        
        // Add candidates
        const candidateNames = ["Alice", "Bob", "Carol"];
        for (let i = 0; i < candidateNames.length; i++) {
            const tx = await orchestrator.connect(admin).addCandidate(candidateNames[i], `Party-${i}`);
            await tx.wait();
            console.log(`   ✅ Added candidate: ${candidateNames[i]}`);
        }
        
        // Create districts and assign voters
        const districts = [];
        for (let i = 0; i < NUM_DISTRICTS; i++) {
            const tx = await orchestrator.connect(admin).createDistrict(`District-${i}`);
            await tx.wait();
            
            const districtAddress = await orchestrator.getDistrictAddress(i);
            const districtContract = await ethers.getContractAt("DistrictVoting", districtAddress);
            
            const startIndex = i * VOTERS_PER_DISTRICT;
            const endIndex = startIndex + VOTERS_PER_DISTRICT;
            const districtVoters = voterSigners.slice(startIndex, endIndex);
            
            districts.push({
                id: i,
                name: `District-${i}`,
                address: districtAddress,
                contract: districtContract,
                voters: districtVoters
            });
            
            console.log(`   ✅ Created ${districts[i].name} with ${districts[i].voters.length} voters at ${districtAddress}`);
        }
        
        // Step 3: Register voters and diagnose
        console.log("\nStep 3: 📝 Register voters with detailed logging");
        
        const regTx = await orchestrator.connect(admin).startRegistration();
        await regTx.wait();
        console.log("✅ Registration phase started");
        
        // Register voters one by one with detailed logging
        for (const district of districts) {
            console.log(`\n   📝 Registering voters in ${district.name}:`);
            
            for (let i = 0; i < district.voters.length; i++) {
                const voter = district.voters[i];
                
                try {
                    const tx = await orchestrator.connect(admin).batchRegisterVoters(district.id, [voter.address]);
                    const receipt = await tx.wait();
                    console.log(`     ✅ Registered voter ${i} (${voter.address.substring(0, 8)}...) - Gas: ${receipt.gasUsed}`);
                } catch (error) {
                    console.log(`     ❌ Failed to register voter ${i}: ${error.message}`);
                    throw error;
                }
            }
            
            console.log(`   ✅ All voters registered in ${district.name}`);
        }
        
        // Verify registration
        const regStats = await orchestrator.getElectionStats();
        console.log(`✅ Total registered voters: ${regStats._totalVotersRegistered}`);
        expect(Number(regStats._totalVotersRegistered)).to.equal(TOTAL_VOTERS);
        
        // Step 4: Start voting with detailed diagnosis
        console.log("\nStep 4: 🗳️ Start voting with detailed diagnosis");
        
        const votingTx = await orchestrator.connect(admin).startVoting();
        await votingTx.wait();
        console.log("✅ Voting phase started");
        
        // Test voting with first voter in first district
        console.log("\n🧪 DIAGNOSTIC VOTING TEST:");
        const testDistrict = districts[0];
        const testVoter = testDistrict.voters[0];
        
        console.log(`Testing with voter: ${testVoter.address}`);
        console.log(`District contract: ${testDistrict.address}`);
        
        // Check voter's balance before voting
        const balanceBefore = await provider.getBalance(testVoter.address);
        console.log(`Voter balance before vote: ${ethers.formatEther(balanceBefore)} ETH`);
        
        // Check if voter is registered
        try {
            // This might not exist in your contract, adjust as needed
            console.log("Checking voter registration status...");
        } catch (error) {
            console.log("Note: Cannot check registration status directly");
        }
        
        // Attempt to vote with detailed error handling
        try {
            console.log("Attempting to cast vote...");
            const scores = [8, 7, 6]; // Simple scores for 3 candidates
            
            console.log(`Scores to cast: [${scores.join(', ')}]`);
            
            // Try with different gas settings
            const gasEstimate = await testDistrict.contract.connect(testVoter).castVote.estimateGas(scores);
            console.log(`Gas estimate: ${gasEstimate}`);
            
            const voteTx = await testDistrict.contract.connect(testVoter).castVote(scores, {
                gasLimit: gasEstimate * 2n, // Double the estimated gas
                gasPrice: ethers.parseUnits("2", "gwei") // Explicit gas price
            });
            
            console.log(`Vote transaction hash: ${voteTx.hash}`);
            
            const voteReceipt = await voteTx.wait();
            console.log(`✅ Vote successful! Gas used: ${voteReceipt.gasUsed}`);
            
            const balanceAfter = await provider.getBalance(testVoter.address);
            console.log(`Voter balance after vote: ${ethers.formatEther(balanceAfter)} ETH`);
            console.log(`Gas cost: ${ethers.formatEther(balanceBefore - balanceAfter)} ETH`);
            
        } catch (error) {
            console.log(`❌ Vote failed with error:`);
            console.log(`   Error name: ${error.name}`);
            console.log(`   Error message: ${error.message}`);
            
            if (error.data) {
                console.log(`   Error data: ${error.data}`);
            }
            
            if (error.reason) {
                console.log(`   Error reason: ${error.reason}`);
            }
            
            // Try to get more details
            if (error.transaction) {
                console.log(`   Transaction that failed:`, error.transaction);
            }
            
            throw error;
        }
        
        // Step 5: Try multiple voters
        console.log("\nStep 5: 🗳️ Test multiple voters sequentially");
        
        let successfulVotes = 0;
        let failedVotes = 0;
        
        for (const district of districts) {
            console.log(`\n   Testing ${district.name}:`);
            
            for (let i = 0; i < district.voters.length; i++) {
                const voter = district.voters[i];
                
                try {
                    const scores = [
                        Math.floor(Math.random() * 6) + 5, // 5-10
                        Math.floor(Math.random() * 6) + 5,
                        Math.floor(Math.random() * 6) + 5
                    ];
                    
                    const voteTx = await district.contract.connect(voter).castVote(scores, {
                        gasLimit: 1000000, // 1M gas limit
                        gasPrice: ethers.parseUnits("2", "gwei")
                    });
                    await voteTx.wait();
                    
                    successfulVotes++;
                    console.log(`     ✅ Voter ${i} voted successfully`);
                    
                } catch (error) {
                    failedVotes++;
                    console.log(`     ❌ Voter ${i} failed: ${error.message.substring(0, 50)}...`);
                    
                    // Log details for first few failures
                    if (failedVotes <= 2) {
                        console.log(`        Full error: ${error.message}`);
                    }
                }
            }
        }
        
        console.log("\n" + "=".repeat(60));
        console.log("🔍 DIAGNOSTIC RESULTS:");
        console.log(`✅ Successful votes: ${successfulVotes}`);
        console.log(`❌ Failed votes: ${failedVotes}`);
        console.log(`📈 Success rate: ${(successfulVotes / (successfulVotes + failedVotes) * 100).toFixed(1)}%`);
        console.log("=".repeat(60));
        
        // Cleanup
        signerManager.clearCache();
        
        // If we get here with good success rate, the issue is scale-related
        if (successfulVotes > 0) {
            console.log("✅ Basic voting works - issue is likely scale-related");
            console.log("💡 Recommendations:");
            console.log("   1. Reduce concurrent voting per district");
            console.log("   2. Add delays between transactions"); 
            console.log("   3. Use sequential rather than parallel processing");
            console.log("   4. Increase gas limits further");
        }
        
        expect(successfulVotes).to.be.greaterThan(0, "At least some votes should succeed");
    });
});