// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/IElectionOrchestrator.sol";

/**
 * @title DistrictVoting
 * @dev Individual district voting contract for decentralized election system with customizable grading scale
 */
contract DistrictVoting {
    address public orchestrator;
    address public factory;
    string public districtName;
    uint256 public districtId;
    
    enum VotingState { Setup, Active, Ended, ResultsSubmitted }
    VotingState public state;
    
    struct Voter {
        bool isRegistered;
        bool hasVoted;
    }
    
    mapping(address => Voter) public voters;
    mapping(address => mapping(uint256 => uint256)) private voterScores;
    mapping(uint256 => uint256) public candidateScores; // candidateId => totalScore
    mapping(uint256 => uint256) public candidateVotes; // candidateId => voteCount
    
    uint256 public totalRegisteredVoters;
    uint256 public totalVotes;
    uint256 public candidateCount;
    
    // Customizable grading scale - now public and immutable after construction
    uint256 public immutable MIN_SCORE;
    uint256 public immutable MAX_SCORE;
    
    // Events
    event VoterRegistered(address indexed voter);
    event VoteCast(address indexed voter);
    event VotingStateChanged(VotingState newState);
    event ResultsSubmitted(uint256[] scores, uint256[] voteCounts);
    event GradingScaleInfo(uint256 minScore, uint256 maxScore);
    
    // Modifiers
    modifier onlyOrchestrator() {
        require(msg.sender == orchestrator, "Only orchestrator can call this");
        _;
    }
    
    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory can call this");
        _;
    }
    
    modifier inState(VotingState _state) {
        require(state == _state, "Invalid voting state");
        _;
    }
    
    modifier onlyRegisteredVoter() {
        require(voters[msg.sender].isRegistered, "Voter not registered");
        _;
    }
    
    modifier hasNotVoted() {
        require(!voters[msg.sender].hasVoted, "Already voted");
        _;
    }
    
    /**
     * @dev Constructor for district voting contract with customizable grading scale
     * @param _orchestrator Address of the main orchestrator contract
     * @param _factory Address of the factory contract that created this district
     * @param _districtName Human-readable name of the district
     * @param _districtId Unique identifier for this district
     * @param _candidateCount Number of candidates in the election
     * @param _minScore Minimum score for voting (customizable)
     * @param _maxScore Maximum score for voting (customizable)
     */
    constructor(
        address _orchestrator,
        address _factory,
        string memory _districtName,
        uint256 _districtId,
        uint256 _candidateCount,
        uint256 _minScore,
        uint256 _maxScore
    ) {
        require(_orchestrator != address(0), "Invalid orchestrator address");
        require(_factory != address(0), "Invalid factory address");
        require(_candidateCount > 0, "Must have at least one candidate");
        require(_maxScore > _minScore, "Max score must be greater than min score");
        require(_maxScore - _minScore <= 100, "Score range too large (max 100 points)");
        
        orchestrator = _orchestrator;
        factory = _factory;
        districtName = _districtName;
        districtId = _districtId;
        candidateCount = _candidateCount;
        MIN_SCORE = _minScore;
        MAX_SCORE = _maxScore;
        state = VotingState.Setup;
        
        emit GradingScaleInfo(_minScore, _maxScore);
    }
    
    /**
     * @dev Get the grading scale information for this district
     * @return minScore Minimum allowed score
     * @return maxScore Maximum allowed score
     * @return scoreRange Range of scores (max - min)
     */
    function getGradingScale() external view returns (
        uint256 minScore,
        uint256 maxScore,
        uint256 scoreRange
    ) {
        return (MIN_SCORE, MAX_SCORE, MAX_SCORE - MIN_SCORE);
    }
    
    /**
     * @dev Check if a score is valid for this district's grading scale
     * @param _score Score to validate
     * @return True if the score is within the valid range
     */
    function isValidScore(uint256 _score) public view returns (bool) {
        return _score >= MIN_SCORE && _score <= MAX_SCORE;
    }
    
    /**
     * @dev Register multiple voters in batch for efficiency
     * @param _voters Array of voter addresses to register
     */
    function batchRegisterVoters(address[] memory _voters) 
        external 
        onlyOrchestrator 
        inState(VotingState.Setup) 
    {
        require(_voters.length > 0, "Empty voter array");
        
        for (uint256 i = 0; i < _voters.length; i++) {
            require(_voters[i] != address(0), "Invalid voter address");
            require(!voters[_voters[i]].isRegistered, "Voter already registered");
            
            voters[_voters[i]] = Voter({
                isRegistered: true,
                hasVoted: false
            });
            
            totalRegisteredVoters++;
            emit VoterRegistered(_voters[i]);
        }
    }
    
    /**
     * @dev Start the voting phase for this district
     */
    function startVoting() external onlyOrchestrator inState(VotingState.Setup) {
        require(totalRegisteredVoters > 0, "No voters registered");
        
        state = VotingState.Active;
        emit VotingStateChanged(state);
    }
    
    /**
     * @dev Cast a vote using score voting methodology with custom grading scale
     * @param _scores Array of scores for each candidate using the district's grading scale
     */
    function castVote(uint256[] memory _scores) 
        external 
        onlyRegisteredVoter 
        hasNotVoted 
        inState(VotingState.Active) 
    {
        require(_scores.length == candidateCount, "Invalid scores array length");
        
        // Validate all scores are within the custom grading scale range
        for (uint256 i = 0; i < _scores.length; i++) {
            require(isValidScore(_scores[i]), "Score out of valid range");
        }
        
        // Record the vote
        for (uint256 i = 0; i < _scores.length; i++) {
            voterScores[msg.sender][i] = _scores[i];
            candidateScores[i] += _scores[i];
            if (_scores[i] > MIN_SCORE) { // Only count as a "vote" if above minimum
                candidateVotes[i]++;
            }
        }
        
        // Update voter state
        voters[msg.sender].hasVoted = true;
        totalVotes++;
        
        emit VoteCast(msg.sender);
    }
    
    /**
     * @dev End the voting phase for this district
     */
    function endVoting() external onlyOrchestrator inState(VotingState.Active) {
        state = VotingState.Ended;
        emit VotingStateChanged(state);
    }
    
    /**
     * @dev Submit district results to the orchestrator
     */
    function submitResults() external onlyOrchestrator inState(VotingState.Ended) {
        uint256[] memory scores = new uint256[](candidateCount);
        uint256[] memory voteCounts = new uint256[](candidateCount);
        
        for (uint256 i = 0; i < candidateCount; i++) {
            scores[i] = candidateScores[i];
            voteCounts[i] = candidateVotes[i];
        }
        
        // Submit to orchestrator
        IElectionOrchestrator(orchestrator).submitDistrictResults(
            districtId,
            scores,
            voteCounts,
            totalVotes
        );
        
        state = VotingState.ResultsSubmitted;
        emit VotingStateChanged(state);
        emit ResultsSubmitted(scores, voteCounts);
    }
    
    /**
     * @dev Get voter's scores for verification (privacy-aware)
     * @param _voter Address of the voter to check
     * @return Array of scores given by the voter
     */
    function getVoterScores(address _voter) external view returns (uint256[] memory) {
        require(voters[_voter].hasVoted, "Voter has not voted yet");
        require(
            state == VotingState.ResultsSubmitted || msg.sender == _voter, 
            "Cannot view others' votes during active election"
        );
        
        uint256[] memory scores = new uint256[](candidateCount);
        for (uint256 i = 0; i < candidateCount; i++) {
            scores[i] = voterScores[_voter][i];
        }
        return scores;
    }
    
    /**
     * @dev Get district statistics including grading scale information
     * @return _totalRegistered Total registered voters
     * @return _totalVotes Total votes cast
     * @return _turnoutPercentage Voter turnout percentage
     * @return _state Current voting state
     * @return _minScore Minimum score for this district
     * @return _maxScore Maximum score for this district
     */
    function getDistrictStats() external view returns (
        uint256 _totalRegistered,
        uint256 _totalVotes,
        uint256 _turnoutPercentage,
        VotingState _state,
        uint256 _minScore,
        uint256 _maxScore
    ) {
        uint256 turnout = totalRegisteredVoters > 0 ? 
            (totalVotes * 100) / totalRegisteredVoters : 0;
            
        return (totalRegisteredVoters, totalVotes, turnout, state, MIN_SCORE, MAX_SCORE);
    }
    
    /**
     * @dev Get candidate results for this district
     * @return candidateIds Array of candidate IDs
     * @return scores Array of total scores per candidate
     * @return voteCounts Array of vote counts per candidate
     */
    function getDistrictResults() external view returns (
        uint256[] memory candidateIds,
        uint256[] memory scores,
        uint256[] memory voteCounts
    ) {
        require(state == VotingState.ResultsSubmitted, "Results not yet submitted");
        
        candidateIds = new uint256[](candidateCount);
        scores = new uint256[](candidateCount);
        voteCounts = new uint256[](candidateCount);
        
        for (uint256 i = 0; i < candidateCount; i++) {
            candidateIds[i] = i;
            scores[i] = candidateScores[i];
            voteCounts[i] = candidateVotes[i];
        }
        
        return (candidateIds, scores, voteCounts);
    }
    
    /**
     * @dev Get normalized scores for comparison across districts with different grading scales
     * This converts scores to a 0-100 scale for standardized comparison
     * @return normalizedScores Array of normalized candidate scores (0-100 scale)
     */
    function getNormalizedResults() external view returns (uint256[] memory normalizedScores) {
        require(state == VotingState.ResultsSubmitted, "Results not yet submitted");
        
        normalizedScores = new uint256[](candidateCount);
        uint256 scoreRange = MAX_SCORE - MIN_SCORE;
        
        for (uint256 i = 0; i < candidateCount; i++) {
            if (totalVotes > 0 && scoreRange > 0) {
                // Convert to 0-100 scale: ((score - (minScore * votes)) / (scoreRange * votes)) * 100
                uint256 adjustedScore = candidateScores[i] - (MIN_SCORE * candidateVotes[i]);
                uint256 maxPossibleAdjusted = scoreRange * candidateVotes[i];
                
                if (maxPossibleAdjusted > 0) {
                    normalizedScores[i] = (adjustedScore * 100) / maxPossibleAdjusted;
                } else {
                    normalizedScores[i] = 0;
                }
            } else {
                normalizedScores[i] = 0;
            }
        }
        
        return normalizedScores;
    }
    
    /**
     * @dev Get average scores per candidate for this district
     * @return averageScores Array of average scores per candidate
     */
    function getAverageScores() external view returns (uint256[] memory averageScores) {
        require(state == VotingState.ResultsSubmitted, "Results not yet submitted");
        
        averageScores = new uint256[](candidateCount);
        
        for (uint256 i = 0; i < candidateCount; i++) {
            if (candidateVotes[i] > 0) {
                averageScores[i] = candidateScores[i] / candidateVotes[i];
            } else {
                averageScores[i] = MIN_SCORE; // Default to minimum if no votes
            }
        }
        
        return averageScores;
    }
    
    /**
     * @dev Check if the district uses a custom grading scale (not 0-10)
     * @return True if using a custom grading scale
     */
    function hasCustomGradingScale() external view returns (bool) {
        return !(MIN_SCORE == 0 && MAX_SCORE == 10);
    }
}