// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IElectionOrchestrator
 * @dev Interface for the Election Orchestrator contract
 */
interface IElectionOrchestrator {
    /**
     * @dev Function called by district contracts to submit their results
     * @param _districtId ID of the district submitting results
     * @param _scores Array of total scores for each candidate
     * @param _voteCounts Array of vote counts for each candidate
     * @param _totalVotes Total number of votes cast in the district
     */
    function submitDistrictResults(
        uint256 _districtId,
        uint256[] memory _scores,
        uint256[] memory _voteCounts,
        uint256 _totalVotes
    ) external;
}