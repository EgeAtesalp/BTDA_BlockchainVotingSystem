// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./DistrictFactory.sol";
import "./DistrictVoting.sol";
import "./interfaces/IElectionOrchestrator.sol";

/**
 * @title ElectionOrchestrator
 * @dev Main contract that orchestrates the entire distributed election system with customizable grading scales
 */
contract ElectionOrchestrator is IElectionOrchestrator {
    address public admin;
    DistrictFactory public factory;
    
    enum ElectionState { Setup, Registration, Voting, Ended, ResultsCollected }
    ElectionState public state;
    
    struct Candidate {
        uint256 id;
        string name;
        string party;
        uint256 totalScore;
        uint256 totalVotes;
    }
    
    struct DistrictResult {
        bool submitted;
        uint256[] scores;
        uint256[] voteCounts;
        uint256 totalVotes;
        uint256 submissionTimestamp;
    }
    
    struct ElectionMetrics {
        uint256 totalDistrictsCreated;
        uint256 totalVotersRegistered;
        uint256 totalVotesCast;
        uint256 resultsSubmittedCount;
        uint256 electionStartTime;
        uint256 electionEndTime;
    }
    
    struct GradingScale {
        uint256 minScore;
        uint256 maxScore;
        bool isCustom;
    }
    
    Candidate[] public candidates;
    mapping(uint256 => DistrictResult) public districtResults; // districtId => results
    uint256[] public activeDistricts;
    ElectionMetrics public metrics;
    GradingScale public gradingScale;
    
    // Election configuration
    uint256 public maxCandidates = 50;
    uint256 public maxDistricts = 1000;
    bool public emergencyStop = false;
    
    // Default grading scale constants
    uint256 public constant DEFAULT_MIN_SCORE = 0;
    uint256 public constant DEFAULT_MAX_SCORE = 10;
    
    // Events
    event CandidateAdded(uint256 indexed candidateId, string name, string party);
    event DistrictCreated(uint256 indexed districtId, address indexed contractAddress);
    event VotersRegistered(uint256 indexed districtId, uint256 voterCount);
    event DistrictResultsReceived(
        uint256 indexed districtId, 
        uint256 totalVotes, 
        uint256 timestamp
    );
    event ElectionResultsFinalized(
        uint256 indexed winnerCandidateId, 
        uint256 totalScore,
        uint256 totalVotes
    );
    event ElectionStateChanged(ElectionState indexed newState, uint256 timestamp);
    event EmergencyStopToggled(bool stopped, address by);
    event GradingScaleSet(uint256 minScore, uint256 maxScore, bool isCustom);
    
    // Modifiers
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }
    
    modifier inState(ElectionState _state) {
        require(state == _state, "Invalid election state");
        _;
    }
    
    modifier notEmergencyStopped() {
        require(!emergencyStop, "Election is emergency stopped");
        _;
    }
    
    modifier validCandidateId(uint256 _candidateId) {
        require(_candidateId < candidates.length, "Invalid candidate ID");
        _;
    }
    
    modifier validDistrictId(uint256 _districtId) {
        require(_districtId < metrics.totalDistrictsCreated, "Invalid district ID");
        _;
    }
    
    /**
     * @dev Constructor - deploys the factory and initializes the election with default grading scale
     */
    constructor() {
        admin = msg.sender;
        factory = new DistrictFactory(address(this));
        state = ElectionState.Setup;
        metrics.electionStartTime = block.timestamp;
        
        // Initialize with default grading scale (0-10)
        gradingScale = GradingScale({
            minScore: DEFAULT_MIN_SCORE,
            maxScore: DEFAULT_MAX_SCORE,
            isCustom: false
        });
    }
    
    /**
     * @dev Set custom grading scale (only during setup phase)
     * @param _minScore Minimum score value
     * @param _maxScore Maximum score value
     */
    function setGradingScale(uint256 _minScore, uint256 _maxScore) 
        external 
        onlyAdmin 
        inState(ElectionState.Setup)
        notEmergencyStopped
    {
        require(_maxScore > _minScore, "Max score must be greater than min score");
        require(_maxScore - _minScore <= 100, "Score range too large (max 100 points)");
        
        gradingScale = GradingScale({
            minScore: _minScore,
            maxScore: _maxScore,
            isCustom: true
        });
        
        emit GradingScaleSet(_minScore, _maxScore, true);
    }
    
    /**
     * @dev Reset to default grading scale (0-10)
     */
    function resetToDefaultGradingScale() 
        external 
        onlyAdmin 
        inState(ElectionState.Setup)
        notEmergencyStopped
    {
        gradingScale = GradingScale({
            minScore: DEFAULT_MIN_SCORE,
            maxScore: DEFAULT_MAX_SCORE,
            isCustom: false
        });
        
        emit GradingScaleSet(DEFAULT_MIN_SCORE, DEFAULT_MAX_SCORE, false);
    }
    
    /**
     * @dev Get current grading scale information
     * @return minScore Minimum allowed score
     * @return maxScore Maximum allowed score
     * @return isCustom Whether a custom scale is being used
     */
    function getGradingScale() external view returns (
        uint256 minScore,
        uint256 maxScore,
        bool isCustom
    ) {
        return (gradingScale.minScore, gradingScale.maxScore, gradingScale.isCustom);
    }
    
    /**
     * @dev Add a candidate to the election
     * @param _name Candidate's name
     * @param _party Candidate's party affiliation
     */
    function addCandidate(string memory _name, string memory _party) 
        external 
        onlyAdmin 
        inState(ElectionState.Setup)
        notEmergencyStopped
    {
        require(bytes(_name).length > 0, "Candidate name cannot be empty");
        require(candidates.length < maxCandidates, "Maximum candidates reached");
        
        candidates.push(Candidate({
            id: candidates.length,
            name: _name,
            party: _party,
            totalScore: 0,
            totalVotes: 0
        }));
        
        emit CandidateAdded(candidates.length - 1, _name, _party);
    }
    
    /**
     * @dev Create a new voting district with current grading scale
     * @param _name District name
     * @return Address of the created district contract
     */
    function createDistrict(string memory _name) 
        external 
        onlyAdmin 
        inState(ElectionState.Setup)
        notEmergencyStopped
        returns (address) 
    {
        require(bytes(_name).length > 0, "District name cannot be empty");
        require(candidates.length > 0, "Must add candidates before creating districts");
        require(activeDistricts.length < maxDistricts, "Maximum districts reached");
        
        uint256 districtId = metrics.totalDistrictsCreated;
        address districtAddress = factory.createDistrict(
            _name, 
            districtId, 
            candidates.length,
            gradingScale.minScore,
            gradingScale.maxScore
        );
        activeDistricts.push(districtId);
        
        metrics.totalDistrictsCreated++;
        
        emit DistrictCreated(districtId, districtAddress);
        return districtAddress;
    }
    
    /**
     * @dev Register voters in batch for a specific district
     * @param _districtId District ID to register voters in
     * @param _voters Array of voter addresses
     */
    function batchRegisterVoters(
        uint256 _districtId, 
        address[] memory _voters
    ) 
        external 
        onlyAdmin 
        inState(ElectionState.Registration)
        notEmergencyStopped
    {
        require(_districtId < activeDistricts.length, "Invalid district ID");
        require(_voters.length > 0, "Empty voters array");
        
        address districtAddress = factory.getDistrictAddress(_districtId);
        DistrictVoting(districtAddress).batchRegisterVoters(_voters);
        
        metrics.totalVotersRegistered += _voters.length;
        
        emit VotersRegistered(_districtId, _voters.length);
    }
    
    /**
     * @dev Transition from setup to registration phase
     */
    function startRegistration() 
        external 
        onlyAdmin 
        inState(ElectionState.Setup)
        notEmergencyStopped
    {
        require(candidates.length > 0, "No candidates added");
        require(metrics.totalDistrictsCreated > 0, "No districts created");
        
        state = ElectionState.Registration;
        emit ElectionStateChanged(state, block.timestamp);
    }
    
    /**
     * @dev Start the voting phase across all districts
     */
    function startVoting() 
        external 
        onlyAdmin 
        inState(ElectionState.Registration)
        notEmergencyStopped
    {
        require(metrics.totalVotersRegistered > 0, "No voters registered");
        
        state = ElectionState.Voting;
        
        // Start voting in all districts
        for (uint256 i = 0; i < metrics.totalDistrictsCreated; i++) {
            address districtAddress = factory.getDistrictAddress(i);
            require(districtAddress != address(0), "Invalid district address");
            DistrictVoting(districtAddress).startVoting();
        }
        
        emit ElectionStateChanged(state, block.timestamp);
    }
    
    /**
     * @dev End the voting phase across all districts
     */
    function endVoting() 
        external 
        onlyAdmin 
        inState(ElectionState.Voting)
    {
        state = ElectionState.Ended;
        metrics.electionEndTime = block.timestamp;
        
        // End voting in all districts
        for (uint256 i = 0; i < metrics.totalDistrictsCreated; i++) {
            address districtAddress = factory.getDistrictAddress(i);
            DistrictVoting(districtAddress).endVoting();
        }
        
        emit ElectionStateChanged(state, block.timestamp);
    }
    
    /**
     * @dev Trigger result collection from all districts
     */
    function collectResults() 
        external 
        onlyAdmin 
        inState(ElectionState.Ended)
    {
        // Trigger result submission from all districts
        for (uint256 i = 0; i < metrics.totalDistrictsCreated; i++) {
            address districtAddress = factory.getDistrictAddress(i);
            DistrictVoting(districtAddress).submitResults();
        }
    }
    
    /**
     * @dev Callback function for districts to submit their results
     * Implementation of IElectionOrchestrator interface
     * @param _districtId District submitting results
     * @param _scores Array of candidate scores
     * @param _voteCounts Array of candidate vote counts
     * @param _totalVotes Total votes in the district
     */
    function submitDistrictResults(
        uint256 _districtId,
        uint256[] memory _scores,
        uint256[] memory _voteCounts,
        uint256 _totalVotes
    ) external override {
        // Verify caller is a valid district contract
        require(
            msg.sender == factory.getDistrictAddress(_districtId), 
            "Invalid caller - not authorized district"
        );
        require(!districtResults[_districtId].submitted, "Results already submitted");
        require(_scores.length == candidates.length, "Invalid scores array length");
        require(_voteCounts.length == candidates.length, "Invalid vote counts array length");
        
        // Store district results
        districtResults[_districtId] = DistrictResult({
            submitted: true,
            scores: _scores,
            voteCounts: _voteCounts,
            totalVotes: _totalVotes,
            submissionTimestamp: block.timestamp
        });
        
        // Aggregate results into candidate totals
        for (uint256 i = 0; i < candidates.length; i++) {
            candidates[i].totalScore += _scores[i];
            candidates[i].totalVotes += _voteCounts[i];
        }
        
        metrics.totalVotesCast += _totalVotes;
        metrics.resultsSubmittedCount++;
        
        emit DistrictResultsReceived(_districtId, _totalVotes, block.timestamp);
        
        // Check if all results have been collected
        if (metrics.resultsSubmittedCount == activeDistricts.length) {
            state = ElectionState.ResultsCollected;
            _finalizeResults();
        }
    }
    
    /**
     * @dev Internal function to finalize election results
     */
    function _finalizeResults() private {
        // Find winner (highest total score)
        uint256 maxScore = 0;
        uint256 winnerId = 0;
        
        for (uint256 i = 0; i < candidates.length; i++) {
            if (candidates[i].totalScore > maxScore) {
                maxScore = candidates[i].totalScore;
                winnerId = i;
            }
        }
        
        emit ElectionResultsFinalized(winnerId, maxScore, metrics.totalVotesCast);
        emit ElectionStateChanged(state, block.timestamp);
    }
    
    // [Rest of the functions remain the same as in the original contract]
    // Including: getElectionResults, getWinner, getDistrictResults, getDistrictAddress,
    // getElectionStats, getElectionMetrics, getCandidateCount, getCandidate,
    // getAllCandidates, getBatchDistrictStatus, setEmergencyStop, updateLimits,
    // transferAdmin, getFactoryAddress, isVotingActive, areResultsFinalized, getElectionDuration
    
    /**
     * @dev Get comprehensive election results
     * @return names Array of candidate names
     * @return parties Array of candidate parties
     * @return totalScores Array of candidate total scores
     * @return totalVotes Array of candidate total votes
     */
    function getElectionResults() external view returns (
        string[] memory names,
        string[] memory parties,
        uint256[] memory totalScores,
        uint256[] memory totalVotes
    ) {
        names = new string[](candidates.length);
        parties = new string[](candidates.length);
        totalScores = new uint256[](candidates.length);
        totalVotes = new uint256[](candidates.length);
        
        for (uint256 i = 0; i < candidates.length; i++) {
            names[i] = candidates[i].name;
            parties[i] = candidates[i].party;
            totalScores[i] = candidates[i].totalScore;
            totalVotes[i] = candidates[i].totalVotes;
        }
    }
    
    /**
     * @dev Get election winner information
     * @return winnerId ID of the winning candidate
     * @return winnerName Name of the winning candidate
     * @return winnerParty Party of the winning candidate
     * @return winnerScore Total score of the winning candidate
     */
    function getWinner() external view returns (
        uint256 winnerId,
        string memory winnerName,
        string memory winnerParty,
        uint256 winnerScore
    ) {
        require(state == ElectionState.ResultsCollected, "Election results not finalized");
        require(candidates.length > 0, "No candidates");
        
        uint256 maxScore = 0;
        uint256 maxId = 0;
        
        for (uint256 i = 0; i < candidates.length; i++) {
            if (candidates[i].totalScore > maxScore) {
                maxScore = candidates[i].totalScore;
                maxId = i;
            }
        }
        
        return (
            maxId,
            candidates[maxId].name,
            candidates[maxId].party,
            candidates[maxId].totalScore
        );
    }
    
    /**
     * @dev Get comprehensive election statistics
     * @return _totalDistricts Total number of districts
     * @return _totalVotersRegistered Total voters registered across all districts
     * @return _totalVotesCast Total votes cast across all districts
     * @return _resultsSubmitted Number of districts that submitted results
     * @return _state Current election state
     * @return _turnoutPercentage Overall voter turnout percentage
     */
    function getElectionStats() external view returns (
        uint256 _totalDistricts,
        uint256 _totalVotersRegistered,
        uint256 _totalVotesCast,
        uint256 _resultsSubmitted,
        ElectionState _state,
        uint256 _turnoutPercentage
    ) {
        uint256 turnout = metrics.totalVotersRegistered > 0 ? 
            (metrics.totalVotesCast * 100) / metrics.totalVotersRegistered : 0;
            
        return (
            metrics.totalDistrictsCreated,
            metrics.totalVotersRegistered,
            metrics.totalVotesCast,
            metrics.resultsSubmittedCount,
            state,
            turnout
        );
    }
}