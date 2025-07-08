// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/IElectionOrchestrator.sol";

/**
 * @title DistrictVoting
 * @dev Individual district voting contract for decentralized election system
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
    
    // Constants for score voting
    uint256 public constant MIN_SCORE = 0;
    uint256 public constant MAX_SCORE = 10;
    
    // Events
    event VoterRegistered(address indexed voter);
    event VoteCast(address indexed voter);
    event VotingStateChanged(VotingState newState);
    event ResultsSubmitted(uint256[] scores, uint256[] voteCounts);
    
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
     * @dev Constructor for district voting contract
     * @param _orchestrator Address of the main orchestrator contract
     * @param _factory Address of the factory contract that created this district
     * @param _districtName Human-readable name of the district
     * @param _districtId Unique identifier for this district
     * @param _candidateCount Number of candidates in the election
     */
    constructor(
        address _orchestrator,
        address _factory,
        string memory _districtName,
        uint256 _districtId,
        uint256 _candidateCount
    ) {
        require(_orchestrator != address(0), "Invalid orchestrator address");
        require(_factory != address(0), "Invalid factory address");
        require(_candidateCount > 0, "Must have at least one candidate");
        
        orchestrator = _orchestrator;
        factory = _factory;
        districtName = _districtName;
        districtId = _districtId;
        candidateCount = _candidateCount;
        state = VotingState.Setup;
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
     * @dev Cast a vote using score voting methodology
     * @param _scores Array of scores (0-10) for each candidate
     */
    function castVote(uint256[] memory _scores) 
        external 
        onlyRegisteredVoter 
        hasNotVoted 
        inState(VotingState.Active) 
    {
        require(_scores.length == candidateCount, "Invalid scores array length");
        
        // Validate all scores are within acceptable range
        for (uint256 i = 0; i < _scores.length; i++) {
            require(_scores[i] >= MIN_SCORE && _scores[i] <= MAX_SCORE, "Score out of range");
        }
        
        // Record the vote
        for (uint256 i = 0; i < _scores.length; i++) {
            voterScores[msg.sender][i] = _scores[i];
            candidateScores[i] += _scores[i];
            if (_scores[i] > 0) {
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
     * @dev Get district statistics
     * @return _totalRegistered Total registered voters
     * @return _totalVotes Total votes cast
     * @return _turnoutPercentage Voter turnout percentage
     * @return _state Current voting state
     */
    function getDistrictStats() external view returns (
        uint256 _totalRegistered,
        uint256 _totalVotes,
        uint256 _turnoutPercentage,
        VotingState _state
    ) {
        uint256 turnout = totalRegisteredVoters > 0 ? 
            (totalVotes * 100) / totalRegisteredVoters : 0;
            
        return (totalRegisteredVoters, totalVotes, turnout, state);
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
}