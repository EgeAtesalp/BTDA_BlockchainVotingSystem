// test/scaling-analysis.js - Comprehensive scaling experiments
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { ScalableSignerManager } = require("../utils/scalableSigners");
const WalletFunder = require("../utils/walletFunding");
const fs = require('fs');
const path = require('path');

describe("🔬 SCALING ANALYSIS EXPERIMENTS (Sequential Processing)", function () {
    let results = [];
    
    // Ensure results directory exists
    before(function() {
        const resultsDir = './results';
        if (!fs.existsSync(resultsDir)) {
            fs.mkdirSync(resultsDir);
        }
    });

    describe("📈 EXPERIMENT 1: Voter Count Scaling (Fixed Districts)", function () {
        
        it("Should analyze performance across different voter counts", async function () {
            this.timeout(7200000); // 2 hours for comprehensive testing
            
            console.log("🔬 EXPERIMENT 1: VOTER COUNT SCALING ANALYSIS (Sequential)");
            console.log("=".repeat(80));
            console.log("📊 Testing different voter counts with fixed district count");
            console.log("🎯 Objective: Analyze how system scales with voter population using sequential processing");
            console.log("=".repeat(80));
            
            // Test configurations: Fixed 5 districts, varying voter counts
            const testConfigurations = [
                { districts: 5, votersPerDistrict: 100, name: "Small" },      // 500 total
                { districts: 5, votersPerDistrict: 200, name: "Medium-S" },   // 1,000 total
                { districts: 5, votersPerDistrict: 500, name: "Medium" },     // 2,500 total
                { districts: 5, votersPerDistrict: 1000, name: "Medium-L" },  // 5,000 total
                { districts: 5, votersPerDistrict: 2000, name: "Large" },     // 10,000 total
                { districts: 5, votersPerDistrict: 5000, name: "X-Large" },   // 25,000 total
                { districts: 5, votersPerDistrict: 10000, name: "XX-Large" }, // 50,000 total
                { districts: 5, votersPerDistrict: 20000, name: "XXX-Large" }, // 100,000 total
            ];
            
            for (const config of testConfigurations) {
                console.log(`\n${"=".repeat(60)}`);
                console.log(`🧪 TESTING: ${config.name} Scale`);
                console.log(`📊 ${config.districts} districts × ${config.votersPerDistrict} voters = ${config.districts * config.votersPerDistrict} total`);
                console.log(`${"=".repeat(60)}`);
                
                const experimentResult = await runScalingExperiment(config, "VOTER_SCALING");
                results.push(experimentResult);
                
                // Save intermediate results
                //saveResults(results, 'voter_scaling_intermediate');
                
                console.log(`✅ Completed ${config.name} scale test`);
                console.log(`⏱️ Total time: ${(experimentResult.totalTime / 1000).toFixed(2)}s`);
                console.log(`⛽ Total gas: ${experimentResult.totalGasUsed.toLocaleString()}`);
                console.log(`💾 Memory peak: ${experimentResult.peakMemoryMB}MB`);
            }
            
            console.log("\n🎉 EXPERIMENT 1 COMPLETED - VOTER SCALING ANALYSIS");
            //saveResults(results.filter(r => r.experimentType === "VOTER_SCALING"), 'voter_scaling_final');
        });
    });

    describe("🏛️ EXPERIMENT 2: District Count Scaling (Fixed Total Voters)", function () {
        
        it("Should analyze performance across different district counts", async function () {
            this.timeout(7200000); // 2 hours for comprehensive testing
            
            console.log("\n🔬 EXPERIMENT 2: DISTRICT COUNT SCALING ANALYSIS (Sequential)");
            console.log("=".repeat(80));
            console.log("📊 Testing different district counts with fixed total voter count");
            console.log("🎯 Objective: Analyze how sequential processing scales with district count");
            console.log("=".repeat(80));
            
            // Test configurations: Fixed 100,000 total voters, varying district counts
            const totalVoters = 100000;
            const testConfigurations = [
                { districts: 1, votersPerDistrict: 100000, name: "Single District" },
                { districts: 2, votersPerDistrict: 50000, name: "Dual Districts" },
                { districts: 5, votersPerDistrict: 20000, name: "Penta Districts" },
                { districts: 10, votersPerDistrict: 10000, name: "Deca Districts" },
                { districts: 20, votersPerDistrict: 5000, name: "Multi Districts" },
                { districts: 50, votersPerDistrict: 2000, name: "Ultra Districts" },
            ];
            
            for (const config of testConfigurations) {
                console.log(`\n${"=".repeat(60)}`);
                console.log(`🧪 TESTING: ${config.name}`);
                console.log(`📊 ${config.districts} districts × ${config.votersPerDistrict} voters = ${config.districts * config.votersPerDistrict} total`);
                console.log(`${"=".repeat(60)}`);
                
                const experimentResult = await runScalingExperiment(config, "DISTRICT_SCALING");
                results.push(experimentResult);
                
                // Save intermediate results
                //saveResults(results, 'district_scaling_intermediate');
                
                console.log(`✅ Completed ${config.name} test`);
                console.log(`⏱️ Total time: ${(experimentResult.totalTime / 1000).toFixed(2)}s`);
                console.log(`⛽ Total gas: ${experimentResult.totalGasUsed.toLocaleString()}`);
                console.log(`💾 Memory peak: ${experimentResult.peakMemoryMB}MB`);
            }
            
            console.log("\n🎉 EXPERIMENT 2 COMPLETED - DISTRICT SCALING ANALYSIS");
            //saveResults(results.filter(r => r.experimentType === "DISTRICT_SCALING"), 'district_scaling_final');
        });
    });

    after(function() {
        // Save all results and generate summary
        saveResults(results, 'complete_scaling_analysis_seq');
        generateSummaryReport(results);
        generateCSVData(results);
    });
});

/**
 * Run a single scaling experiment
 */
async function runScalingExperiment(config, experimentType) {
    const startTime = Date.now();
    const metrics = {
        experimentType,
        config,
        timestamp: new Date().toISOString(),
        totalVoters: config.districts * config.votersPerDistrict,
        
        // Timing metrics
        walletGenerationTime: 0,
        walletFundingTime: 0,
        contractDeploymentTime: 0,
        electionSetupTime: 0,
        voterRegistrationTime: 0,
        votingTime: 0,
        resultsCollectionTime: 0,
        totalTime: 0,
        
        // Gas metrics
        deploymentGas: 0,
        registrationGas: 0,
        votingGas: 0,
        totalGasUsed: 0,
        
        // Performance metrics
        peakMemoryMB: 0,
        walletGenerationRate: 0,
        votingRate: 0,
        successfulVotes: 0,
        failedVotes: 0,
        successRate: 0,
        
        // System metrics
        averageBlockTime: 0,
        transactionsPerSecond: 0,
        
        errors: []
    };
    
    try {
        // Get initial memory
        const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024;
        
        // Phase 1: Wallet Generation
        console.log("Phase 1: 🔧 Wallet Generation");
        const walletStart = Date.now();
        
        const signerManager = new ScalableSignerManager();
        const [admin] = await ethers.getSigners();
        
        const voterWallets = await signerManager.getVoterWallets(metrics.totalVoters);
        const provider = ethers.provider;
        const voterSigners = voterWallets.map(walletData => 
            new ethers.Wallet(walletData.privateKey, provider)
        );
        
        metrics.walletGenerationTime = Date.now() - walletStart;
        metrics.walletGenerationRate = metrics.totalVoters / (metrics.walletGenerationTime / 1000);
        
        const memUsage = signerManager.getMemoryUsage();
        metrics.peakMemoryMB = Math.max(metrics.peakMemoryMB, memUsage.actualMemoryMB);
        
        console.log(`   ✅ Generated ${metrics.totalVoters} wallets in ${metrics.walletGenerationTime}ms`);
        console.log(`   📈 Rate: ${Math.round(metrics.walletGenerationRate)} wallets/sec`);
        
        // Phase 2: Wallet Funding
        console.log("Phase 2: 💰 Wallet Funding");
        const fundingStart = Date.now();
        
        const funder = new WalletFunder(admin, {
            fundingAmount: ethers.parseEther("1.0"), // Use same as your experiment
            batchSize: 50 // Use same as your experiment
        });
        
        const fundingResult = await funder.fundWallets(voterSigners);
        metrics.walletFundingTime = Date.now() - fundingStart;
        
        console.log(`   ✅ Funded ${fundingResult.successCount} wallets in ${metrics.walletFundingTime}ms`);
        
        // Phase 3: Contract Deployment
        console.log("Phase 3: 🏗️ Contract Deployment");
        const deployStart = Date.now();
        
        const OrchestratorFactory = await ethers.getContractFactory("ElectionOrchestrator");
        const orchestrator = await OrchestratorFactory.connect(admin).deploy();
        const deployReceipt = await orchestrator.waitForDeployment();
        
        // Get deployment gas cost
        const deployTx = await provider.getTransaction(deployReceipt.deploymentTransaction().hash);
        const deployTxReceipt = await provider.getTransactionReceipt(deployReceipt.deploymentTransaction().hash);
        metrics.deploymentGas = Number(deployTxReceipt.gasUsed);
        
        metrics.contractDeploymentTime = Date.now() - deployStart;
        console.log(`   ✅ Deployed contracts in ${metrics.contractDeploymentTime}ms`);
        console.log(`   ⛽ Deployment gas: ${metrics.deploymentGas.toLocaleString()}`);
        
        // Phase 4: Election Setup
        console.log("Phase 4: 🗳️ Election Setup");
        const setupStart = Date.now();
        
        // Add candidates
        const candidateNames = ["Alice", "Bob", "Carol", "David", "Eva"];
        for (let i = 0; i < candidateNames.length; i++) {
            await orchestrator.connect(admin).addCandidate(candidateNames[i], `Party-${i}`);
        }
        
        // Create districts
        const districts = [];
        for (let i = 0; i < config.districts; i++) {
            await orchestrator.connect(admin).createDistrict(`District-${i}`);
            
            const districtAddress = await orchestrator.getDistrictAddress(i);
            const districtContract = await ethers.getContractAt("DistrictVoting", districtAddress);
            
            const startIndex = i * config.votersPerDistrict;
            const endIndex = startIndex + config.votersPerDistrict;
            const districtVoters = voterSigners.slice(startIndex, endIndex);
            
            districts.push({
                id: i,
                contract: districtContract,
                voters: districtVoters
            });
        }
        
        metrics.electionSetupTime = Date.now() - setupStart;
        console.log(`   ✅ Setup election with ${config.districts} districts in ${metrics.electionSetupTime}ms`);
        
        // Phase 5: Voter Registration (Sequential)
        console.log("Phase 5: 📝 Sequential Voter Registration");
        const registrationStart = Date.now();
        let totalRegistrationGas = 0;
        
        await orchestrator.connect(admin).startRegistration();
        
        // Process districts sequentially instead of parallel
        for (const district of districts) {
            const batchSize = 50;
            let districtGas = 0;
            
            for (let i = 0; i < district.voters.length; i += batchSize) {
                const batch = district.voters.slice(i, i + batchSize);
                const voterAddresses = batch.map(v => v.address);
                
                const tx = await orchestrator.connect(admin).batchRegisterVoters(district.id, voterAddresses);
                const receipt = await tx.wait();
                districtGas += Number(receipt.gasUsed);
            }
            
            totalRegistrationGas += districtGas;
        }
        
        metrics.voterRegistrationTime = Date.now() - registrationStart;
        metrics.registrationGas = totalRegistrationGas;
        
        console.log(`   ✅ Registered ${metrics.totalVoters} voters in ${metrics.voterRegistrationTime}ms`);
        console.log(`   ⛽ Registration gas: ${metrics.registrationGas.toLocaleString()}`);
        
        // Phase 6: Sequential Voting (Key Fix!)
        console.log("Phase 6: 🗳️ Sequential District Voting");
        const votingStart = Date.now();
        let totalVotingGas = 0;
        let successfulVotes = 0;
        let failedVotes = 0;
        
        await orchestrator.connect(admin).startVoting();
        
        // Process districts ONE AT A TIME (sequential)
        for (let d = 0; d < districts.length; d++) {
            const district = districts[d];
            console.log(`   🗳️ Processing District ${d + 1}/${districts.length}: ${district.voters.length} voters...`);
            
            let districtSuccessful = 0;
            let districtFailed = 0;
            let districtGas = 0;
            
            // Within each district, process voters in small batches sequentially
            const VOTING_BATCH_SIZE = 20;
            
            for (let i = 0; i < district.voters.length; i += VOTING_BATCH_SIZE) {
                const chunk = district.voters.slice(i, i + VOTING_BATCH_SIZE);
                
                // Process chunk sequentially (not parallel)
                for (const voter of chunk) {
                    try {
                        const scores = Array.from({length: 5}, () => Math.floor(Math.random() * 11));
                        const voteTx = await district.contract.connect(voter).castVote(scores, {
                            gasLimit: 1000000, // Higher gas limit
                            gasPrice: ethers.parseUnits("2", "gwei") // Explicit gas price
                        });
                        const receipt = await voteTx.wait();
                        
                        districtSuccessful++;
                        districtGas += Number(receipt.gasUsed);
                        
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
                if (i % (VOTING_BATCH_SIZE * 10) === 0 || processed === district.voters.length) {
                    console.log(`     📊 District ${d + 1}: ${processed}/${district.voters.length} processed (${districtSuccessful} successful)`);
                }
            }
            
            successfulVotes += districtSuccessful;
            failedVotes += districtFailed;
            totalVotingGas += districtGas;
            
            const successRate = (districtSuccessful / district.voters.length * 100).toFixed(1);
            console.log(`   ✅ District ${d + 1}: ${districtSuccessful}/${district.voters.length} votes (${successRate}%)`);
        }
        
        metrics.votingTime = Date.now() - votingStart;
        metrics.votingGas = totalVotingGas;
        metrics.successfulVotes = successfulVotes;
        metrics.failedVotes = failedVotes;
        metrics.successRate = (successfulVotes / (successfulVotes + failedVotes)) * 100;
        metrics.votingRate = successfulVotes / (metrics.votingTime / 1000);
        
        console.log(`   ✅ Completed voting in ${metrics.votingTime}ms`);
        console.log(`   📊 Successful votes: ${successfulVotes}/${successfulVotes + failedVotes} (${metrics.successRate.toFixed(1)}%)`);
        console.log(`   📈 Voting rate: ${Math.round(metrics.votingRate)} votes/sec`);
        console.log(`   ⛽ Voting gas: ${metrics.votingGas.toLocaleString()}`);
        
        // Phase 7: Results Collection
        console.log("Phase 7: 📊 Results Collection");
        const resultsStart = Date.now();
        
        await orchestrator.connect(admin).endVoting();
        await orchestrator.connect(admin).collectResults();
        
        metrics.resultsCollectionTime = Date.now() - resultsStart;
        console.log(`   ✅ Collected results in ${metrics.resultsCollectionTime}ms`);
        
        // Calculate final metrics
        metrics.totalTime = Date.now() - startTime;
        metrics.totalGasUsed = metrics.deploymentGas + metrics.registrationGas + metrics.votingGas;
        metrics.transactionsPerSecond = (successfulVotes + config.districts * 2) / (metrics.totalTime / 1000); // Rough estimate
        
        const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024;
        metrics.peakMemoryMB = Math.max(metrics.peakMemoryMB, finalMemory);
        
        // Cleanup
        signerManager.clearCache();
        
        console.log(`\n📊 EXPERIMENT SUMMARY:`);
        console.log(`   ⏱️ Total time: ${(metrics.totalTime / 1000).toFixed(2)}s`);
        console.log(`   ⛽ Total gas: ${metrics.totalGasUsed.toLocaleString()}`);
        console.log(`   💾 Peak memory: ${metrics.peakMemoryMB.toFixed(1)}MB`);
        console.log(`   📈 Success rate: ${metrics.successRate.toFixed(1)}%`);
        
    } catch (error) {
        metrics.errors.push(error.message);
        console.error(`❌ Experiment failed: ${error.message}`);
    }
    
    return metrics;
}

/**
 * Save results to JSON file
 */
function saveResults(results, filename) {
    const resultsPath = path.join('./results', `${filename}.json`);
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`💾 Results saved to ${resultsPath}`);
}

/**
 * Generate CSV data for graphing
 */
function generateCSVData(results) {
    const csvData = [
        'ExperimentType,Districts,VotersPerDistrict,TotalVoters,TotalTimeMS,WalletGenTimeMS,FundingTimeMS,RegistrationTimeMS,VotingTimeMS,TotalGas,DeploymentGas,RegistrationGas,VotingGas,SuccessfulVotes,FailedVotes,SuccessRate,PeakMemoryMB,VotingRatePerSec,WalletGenRatePerSec'
    ];
    
    results.forEach(result => {
        const row = [
            result.experimentType,
            result.config.districts,
            result.config.votersPerDistrict,
            result.totalVoters,
            result.totalTime,
            result.walletGenerationTime,
            result.walletFundingTime,
            result.voterRegistrationTime,
            result.votingTime,
            result.totalGasUsed,
            result.deploymentGas,
            result.registrationGas,
            result.votingGas,
            result.successfulVotes,
            result.failedVotes,
            result.successRate.toFixed(2),
            result.peakMemoryMB.toFixed(1),
            result.votingRate.toFixed(1),
            result.walletGenerationRate.toFixed(1)
        ].join(',');
        
        csvData.push(row);
    });
    
    const csvPath = path.join('./results', 'scaling_analysis_seq.csv');
    fs.writeFileSync(csvPath, csvData.join('\n'));
    console.log(`📊 CSV data saved to ${csvPath}`);
}

/**
 * Generate summary report
 */
function generateSummaryReport(results) {
    const report = {
        generatedAt: new Date().toISOString(),
        totalExperiments: results.length,
        voterScalingExperiments: results.filter(r => r.experimentType === "VOTER_SCALING").length,
        districtScalingExperiments: results.filter(r => r.experimentType === "DISTRICT_SCALING").length,
        
        // Performance insights
        insights: {
            maxVotersProcessed: Math.max(...results.map(r => r.totalVoters)),
            maxDistrictsTested: Math.max(...results.map(r => r.config.districts)),
            bestVotingRate: Math.max(...results.map(r => r.votingRate || 0)),
            averageSuccessRate: results.reduce((sum, r) => sum + r.successRate, 0) / results.length,
            totalGasAnalyzed: results.reduce((sum, r) => sum + r.totalGasUsed, 0),
        },
        
        // Raw results for further analysis
        detailedResults: results
    };
    
    const reportPath = path.join('./results', 'scaling_summary_seq_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📋 Summary report saved to ${reportPath}`);
    
    // Print summary to console
    console.log("\n" + "=".repeat(80));
    console.log("📊 SCALING ANALYSIS SUMMARY");
    console.log("=".repeat(80));
    console.log(`🧪 Total experiments: ${report.totalExperiments}`);
    console.log(`👥 Max voters processed: ${report.insights.maxVotersProcessed.toLocaleString()}`);
    console.log(`🏛️ Max districts tested: ${report.insights.maxDistrictsTested}`);
    console.log(`⚡ Best voting rate: ${report.insights.bestVotingRate.toFixed(1)} votes/sec`);
    console.log(`📈 Average success rate: ${report.insights.averageSuccessRate.toFixed(1)}%`);
    console.log(`⛽ Total gas analyzed: ${report.insights.totalGasAnalyzed.toLocaleString()}`);
    console.log("=".repeat(80));
}