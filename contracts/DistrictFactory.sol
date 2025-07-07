// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./DistrictVoting.sol";

/**
 * @title DistrictFactory
 * @dev Factory contract for creating and managing district voting contracts
 */
contract DistrictFactory {
    address public orchestrator;
    address[] public districtContracts;
    mapping(uint256 => address) public districtById;
    mapping(address => uint256) public districtIdByAddress;
    mapping(address => bool) public isValidDistrict;
    
    uint256 public totalDistrictsCreated;
    
    // Events
    event DistrictCreated(
        uint256 indexed districtId, 
        address indexed contractAddress, 
        string name,
        uint256 candidateCount
    );
    event DistrictStatusUpdated(uint256 indexed districtId, bool isActive);
    
    // Modifiers
    modifier onlyOrchestrator() {
        require(msg.sender == orchestrator, "Only orchestrator can call this");
        _;
    }
    
    modifier validDistrictId(uint256 _districtId) {
        require(_districtId < totalDistrictsCreated, "Invalid district ID");
        require(districtById[_districtId] != address(0), "District not found");
        _;
    }
    
    /**
     * @dev Constructor for the district factory
     * @param _orchestrator Address of the orchestrator contract
     */
    constructor(address _orchestrator) {
        require(_orchestrator != address(0), "Invalid orchestrator address");
        orchestrator = _orchestrator;
        totalDistrictsCreated = 0;
    }
    
    /**
     * @dev Create a new district voting contract
     * @param _name Human-readable name for the district
     * @param _districtId Unique identifier for the district
     * @param _candidateCount Number of candidates in the election
     * @return Address of the newly created district contract
     */
    function createDistrict(
        string memory _name,
        uint256 _districtId,
        uint256 _candidateCount
    ) external onlyOrchestrator returns (address) {
        require(bytes(_name).length > 0, "District name cannot be empty");
        require(_candidateCount > 0, "Must have at least one candidate");
        require(districtById[_districtId] == address(0), "District ID already exists");
        
        // Create new district contract
        DistrictVoting newDistrict = new DistrictVoting(
            orchestrator,
            address(this),
            _name,
            _districtId,
            _candidateCount
        );
        
        address districtAddress = address(newDistrict);
        
        // Register the new district
        districtContracts.push(districtAddress);
        districtById[_districtId] = districtAddress;
        districtIdByAddress[districtAddress] = _districtId;
        isValidDistrict[districtAddress] = true;
        
        totalDistrictsCreated++;
        
        emit DistrictCreated(_districtId, districtAddress, _name, _candidateCount);
        
        return districtAddress;
    }
    
    /**
     * @dev Get the address of a district by its ID
     * @param _districtId The district ID to lookup
     * @return Address of the district contract
     */
    function getDistrictAddress(uint256 _districtId) 
        external 
        view 
        validDistrictId(_districtId) 
        returns (address) 
    {
        return districtById[_districtId];
    }
    
    /**
     * @dev Get the ID of a district by its contract address
     * @param _districtAddress The district contract address
     * @return District ID
     */
    function getDistrictId(address _districtAddress) external view returns (uint256) {
        require(isValidDistrict[_districtAddress], "Invalid district address");
        return districtIdByAddress[_districtAddress];
    }
    
    /**
     * @dev Get the total number of districts created
     * @return Total number of districts
     */
    function getDistrictCount() external view returns (uint256) {
        return districtContracts.length;
    }
    
    /**
     * @dev Get all district contract addresses
     * @return Array of all district contract addresses
     */
    function getAllDistricts() external view returns (address[] memory) {
        return districtContracts;
    }
    
    /**
     * @dev Get district information by ID
     * @param _districtId The district ID
     * @return districtAddress Address of the district contract
     * @return districtName Name of the district
     * @return isActive Whether the district is active
     */
    function getDistrictInfo(uint256 _districtId) 
        external 
        view 
        validDistrictId(_districtId) 
        returns (
            address districtAddress,
            string memory districtName,
            bool isActive
        ) 
    {
        address addr = districtById[_districtId];
        DistrictVoting district = DistrictVoting(addr);
        
        return (
            addr,
            district.districtName(),
            isValidDistrict[addr]
        );
    }
    
    /**
     * @dev Verify if an address is a valid district contract created by this factory
     * @param _districtAddress Address to verify
     * @return True if the address is a valid district contract
     */
    function isDistrictValid(address _districtAddress) external view returns (bool) {
        return isValidDistrict[_districtAddress];
    }
    
    /**
     * @dev Get batch information about multiple districts
     * @param _districtIds Array of district IDs to query
     * @return addresses Array of district contract addresses
     * @return names Array of district names
     * @return states Array of district voting states
     */
    function getBatchDistrictInfo(uint256[] memory _districtIds) 
        external 
        view 
        returns (
            address[] memory addresses,
            string[] memory names,
            DistrictVoting.VotingState[] memory states
        ) 
    {
        require(_districtIds.length > 0, "Empty district IDs array");
        
        addresses = new address[](_districtIds.length);
        names = new string[](_districtIds.length);
        states = new DistrictVoting.VotingState[](_districtIds.length);
        
        for (uint256 i = 0; i < _districtIds.length; i++) {
            require(_districtIds[i] < totalDistrictsCreated, "Invalid district ID in batch");
            
            address addr = districtById[_districtIds[i]];
            require(addr != address(0), "District not found in batch");
            
            DistrictVoting district = DistrictVoting(addr);
            
            addresses[i] = addr;
            names[i] = district.districtName();
            states[i] = district.state();
        }
        
        return (addresses, names, states);
    }
    
    /**
     * @dev Emergency function to deactivate a district (only orchestrator)
     * @param _districtId District ID to deactivate
     */
    function deactivateDistrict(uint256 _districtId) 
        external 
        onlyOrchestrator 
        validDistrictId(_districtId) 
    {
        address districtAddress = districtById[_districtId];
        isValidDistrict[districtAddress] = false;
        
        emit DistrictStatusUpdated(_districtId, false);
    }
    
    /**
     * @dev Emergency function to reactivate a district (only orchestrator)
     * @param _districtId District ID to reactivate
     */
    function reactivateDistrict(uint256 _districtId) 
        external 
        onlyOrchestrator 
        validDistrictId(_districtId) 
    {
        address districtAddress = districtById[_districtId];
        isValidDistrict[districtAddress] = true;
        
        emit DistrictStatusUpdated(_districtId, true);
    }
}