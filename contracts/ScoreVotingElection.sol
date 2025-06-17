// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title ScoreVotingElection
 * @dev Implements score voting for country-wide elections
 * Based on the blockchain e-voting paper requirements
 */
contract ScoreVotingElection {
    
    // Election administrator
    address public admin;
    
    // Election state
    enum ElectionState { Registration, Voting, Ended }
    ElectionState public state;
    
    // Candidate structure
    struct Candidate {
        uint256 id;
        string name;
        string party;
        uint256 totalScore;
        uint256 voteCount;
    }
    
    // Voter structure
    struct Voter {
        bool isRegistered;
        bool hasVoted;
        uint256 district;
    }
    
    // District structure for country-wide elections
    struct District {
        string name;
        uint256 registeredVoters;
        uint256 totalVotes;
        bool isActive;
    }
    
    // Storage
    mapping(address => Voter) public voters;
    mapping(uint256 => Candidate) public candidates;
    mapping(uint256 => District) public districts;
    mapping(address => mapping(uint256 => uint256)) private voterScores; // voter => candidateId => score
    
    uint256 public candidateCount;
    uint256 public districtCount;
    uint256 public totalRegisteredVoters;
    uint256 public totalVotes;
    
    // Score voting parameters
    uint256 public constant MIN_SCORE = 0;
    uint256 public constant MAX_SCORE = 10;
    
    // Events
    event VoterRegistered(address indexed voter, uint256 district);
    event CandidateAdded(uint256 indexed candidateId, string name, string party);
    event DistrictCreated(uint256 indexed districtId, string name);
    event VoteCast(address indexed voter, uint256 district);
    event ElectionStateChanged(ElectionState newState);
    event ElectionResults(uint256 winnerCandidateId, uint256 totalScore);
    
    // Modifiers
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }
    
    modifier inState(ElectionState _state) {
        require(state == _state, "Invalid election state");
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
    
    constructor() {
        admin = msg.sender;
        state = ElectionState.Registration;
        candidateCount = 0;
        districtCount = 0;
        totalRegisteredVoters = 0;
        totalVotes = 0;
    }
    
    /**
     * @dev Create a new district (for country-wide elections)
     */
    function createDistrict(string memory _name) external {
        require(msg.sender == admin, "Only admin can perform this action");
        require(state == ElectionState.Registration, "Invalid election state");
        
        districts[districtCount] = District({
            name: _name,
            registeredVoters: 0,
            totalVotes: 0,
            isActive: true
        });
        
        emit DistrictCreated(districtCount, _name);
        districtCount++;
    }
    
    /**
     * @dev Add a candidate to the election
     */
    function addCandidate(string memory _name, string memory _party) external {
        require(msg.sender == admin, "Only admin can perform this action");
        require(state == ElectionState.Registration, "Invalid election state");
        
        candidates[candidateCount] = Candidate({
            id: candidateCount,
            name: _name,
            party: _party,
            totalScore: 0,
            voteCount: 0
        });
        
        emit CandidateAdded(candidateCount, _name, _party);
        candidateCount++;
    }
    
    /**
     * @dev Register a voter in a specific district
     */
    function registerVoter(address _voter, uint256 _districtId) external {
        require(msg.sender == admin, "Only admin can perform this action");
        require(state == ElectionState.Registration, "Invalid election state");
        require(_districtId < districtCount, "Invalid district");
        require(!voters[_voter].isRegistered, "Voter already registered");
        require(districts[_districtId].isActive, "District not active");
        
        voters[_voter] = Voter({
            isRegistered: true,
            hasVoted: false,
            district: _districtId
        });
        
        districts[_districtId].registeredVoters = districts[_districtId].registeredVoters + 1;
        totalRegisteredVoters = totalRegisteredVoters + 1;
        
        emit VoterRegistered(_voter, _districtId);
    }
    
    /**
     * @dev Start the voting phase
     */
    function startVoting() external {
        require(msg.sender == admin, "Only admin can perform this action");
        require(state == ElectionState.Registration, "Invalid election state");
        require(candidateCount > 0, "No candidates registered");
        require(totalRegisteredVoters > 0, "No voters registered");
        
        state = ElectionState.Voting;
        emit ElectionStateChanged(state);
    }
    
    /**
     * @dev Cast vote using score voting (rate each candidate 0-10)
     * @param _scores Array of scores for each candidate (index = candidateId)
     */
    function castVote(uint256[] memory _scores) external {
        require(voters[msg.sender].isRegistered, "Voter not registered");
        require(!voters[msg.sender].hasVoted, "Already voted");
        require(state == ElectionState.Voting, "Invalid election state");
        require(_scores.length == candidateCount, "Invalid number of scores");
        
        // Validate all scores are within range
        for (uint256 i = 0; i < _scores.length; i++) {
            require(_scores[i] >= MIN_SCORE && _scores[i] <= MAX_SCORE, "Score out of range");
        }
        
        // Record the vote
        uint256 voterDistrict = voters[msg.sender].district;
        
        for (uint256 i = 0; i < _scores.length; i++) {
            voterScores[msg.sender][i] = _scores[i];
            candidates[i].totalScore = candidates[i].totalScore + _scores[i];
            if (_scores[i] > 0) {
                candidates[i].voteCount = candidates[i].voteCount + 1;
            }
        }
        
        // Update voter and district state
        voters[msg.sender].hasVoted = true;
        districts[voterDistrict].totalVotes = districts[voterDistrict].totalVotes + 1;
        totalVotes = totalVotes + 1;
        
        emit VoteCast(msg.sender, voterDistrict);
    }
    
    /**
     * @dev End the election and determine winner
     */
    function endElection() external {
        require(msg.sender == admin, "Only admin can perform this action");
        require(state == ElectionState.Voting, "Invalid election state");
        
        state = ElectionState.Ended;
        
        // Find winner (highest total score)
        uint256 winnerScore = 0;
        uint256 winnerId = 0;
        
        for (uint256 i = 0; i < candidateCount; i++) {
            if (candidates[i].totalScore > winnerScore) {
                winnerScore = candidates[i].totalScore;
                winnerId = i;
            }
        }
        
        emit ElectionStateChanged(state);
        emit ElectionResults(winnerId, winnerScore);
    }
    
    /**
     * @dev Get candidate information
     */
    function getCandidate(uint256 _candidateId) external view returns (
        uint256 id,
        string memory name,
        string memory party,
        uint256 totalScore,
        uint256 voteCount
    ) {
        require(_candidateId < candidateCount, "Invalid candidate ID");
        Candidate memory candidate = candidates[_candidateId];
        return (candidate.id, candidate.name, candidate.party, candidate.totalScore, candidate.voteCount);
    }
    
    /**
     * @dev Get district information
     */
    function getDistrict(uint256 _districtId) external view returns (
        string memory name,
        uint256 registeredVoters,
        uint256 totalVotes,
        bool isActive
    ) {
        require(_districtId < districtCount, "Invalid district ID");
        District memory district = districts[_districtId];
        return (district.name, district.registeredVoters, district.totalVotes, district.isActive);
    }
    
    /**
     * @dev Get voter's scores (for verification after voting)
     */
    function getVoterScores(address _voter) external view returns (uint256[] memory) {
        require(voters[_voter].hasVoted, "Voter has not voted yet");
        require(state == ElectionState.Ended || msg.sender == _voter, "Cannot view others' votes during election");
        
        uint256[] memory scores = new uint256[](candidateCount);
        for (uint256 i = 0; i < candidateCount; i++) {
            scores[i] = voterScores[_voter][i];
        }
        return scores;
    }
    
    /**
     * @dev Get election results summary
     */
    function getResults() external view returns (
        uint256[] memory candidateIds,
        uint256[] memory totalScores,
        uint256[] memory voteCounts
    ) {
        require(state == ElectionState.Ended, "Invalid election state");
        
        candidateIds = new uint256[](candidateCount);
        totalScores = new uint256[](candidateCount);
        voteCounts = new uint256[](candidateCount);
        
        for (uint256 i = 0; i < candidateCount; i++) {
            candidateIds[i] = candidates[i].id;
            totalScores[i] = candidates[i].totalScore;
            voteCounts[i] = candidates[i].voteCount;
        }
        
        return (candidateIds, totalScores, voteCounts);
    }
    
    /**
     * @dev Get district results
     */
    function getDistrictTurnout(uint256 _districtId) external view returns (uint256 turnoutPercentage) {
        require(_districtId < districtCount, "Invalid district ID");
        District memory district = districts[_districtId];
        
        if (district.registeredVoters == 0) {
            return 0;
        }
        
        return (district.totalVotes * 100) / district.registeredVoters;
    }
    
    /**
     * @dev Get overall election statistics
     */
    function getElectionStats() external view returns (
        uint256 _totalRegisteredVoters,
        uint256 _totalVotesCast,
        uint256 _candidateCount,
        uint256 _districtCount,
        uint256 _turnoutPercentage
    ) {
        uint256 turnout = totalRegisteredVoters > 0 ? (totalVotes * 100) / totalRegisteredVoters : 0;
        
        return (
            totalRegisteredVoters,
            totalVotes,
            candidateCount,
            districtCount,
            turnout
        );
    }
}