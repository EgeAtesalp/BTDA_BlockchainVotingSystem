// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title MinimalVoting - Simplified test contract
 * @dev Minimal version to test basic functionality
 */
contract MinimalVoting {
    
    address public admin;
    uint256 public districtCount;
    uint256 public candidateCount;
    
    struct District {
        string name;
        bool isActive;
    }
    
    struct Candidate {
        string name;
        uint256 totalScore;
    }
    
    mapping(uint256 => District) public districts;
    mapping(uint256 => Candidate) public candidates;
    
    constructor() {
        admin = msg.sender;
        districtCount = 0;
        candidateCount = 0;
    }
    
    function createDistrict(string memory _name) external {
        require(msg.sender == admin, "Only admin allowed");
        
        districts[districtCount] = District({
            name: _name,
            isActive: true
        });
        
        districtCount++;
    }
    
    function addCandidate(string memory _name) external {
        require(msg.sender == admin, "Only admin allowed");
        
        candidates[candidateCount] = Candidate({
            name: _name,
            totalScore: 0
        });
        
        candidateCount = candidateCount + 1;
    }
    
    function getDistrict(uint256 _id) external view returns (string memory name, bool isActive) {
        require(_id < districtCount, "Invalid district ID");
        District memory d = districts[_id];
        return (d.name, d.isActive);
    }
    
    function getCandidate(uint256 _id) external view returns (string memory name, uint256 totalScore) {
        require(_id < candidateCount, "Invalid candidate ID");
        Candidate memory c = candidates[_id];
        return (c.name, c.totalScore);
    }
}