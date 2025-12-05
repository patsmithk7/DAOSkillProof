pragma solidity ^0.8.24;

import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";


contract DAOSkillProofFHE is SepoliaConfig {
    using FHE for euint32;
    using FHE for ebool;

    error NotOwner();
    error NotProvider();
    error Paused();
    error CooldownActive();
    error InvalidBatch();
    error BatchClosed();
    error InvalidArgument();
    error ReplayDetected();
    error StateMismatch();
    error DecryptionFailed();

    struct SkillContribution {
        euint32 skillScore;
        euint32 contributionScore;
        euint32 totalScore;
        bool exists;
    }

    struct Batch {
        uint32 id;
        bool open;
    }

    struct DecryptionContext {
        uint32 batchId;
        bytes32 stateHash;
        bool processed;
    }

    event ProviderAdded(address indexed provider);
    event ProviderRemoved(address indexed provider);
    event Paused(address indexed account);
    event Unpaused(address indexed account);
    event CooldownSet(uint256 cooldownSeconds);
    event BatchOpened(uint32 indexed batchId);
    event BatchClosed(uint32 indexed batchId);
    event ContributionSubmitted(address indexed provider, uint32 indexed batchId, bytes32 indexed contributionId);
    event DecryptionRequested(uint256 indexed requestId, uint32 indexed batchId);
    event DecryptionCompleted(uint256 indexed requestId, uint32 indexed batchId, uint256 totalScoreSum);

    mapping(address => bool) public providers;
    mapping(uint32 => Batch) public batches;
    mapping(bytes32 => SkillContribution) public contributions;
    mapping(uint256 => DecryptionContext) public decryptionContexts;
    mapping(address => uint256) public lastSubmissionTime;
    mapping(address => uint256) public lastDecryptionRequestTime;

    address public owner;
    bool public paused;
    uint256 public cooldownSeconds;

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyProvider() {
        if (!providers[msg.sender]) revert NotProvider();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }

    modifier checkSubmissionCooldown() {
        if (block.timestamp < lastSubmissionTime[msg.sender] + cooldownSeconds) {
            revert CooldownActive();
        }
        _;
    }

    modifier checkDecryptionCooldown() {
        if (block.timestamp < lastDecryptionRequestTime[msg.sender] + cooldownSeconds) {
            revert CooldownActive();
        }
        _;
    }

    constructor() {
        owner = msg.sender;
        cooldownSeconds = 60; 
        _initIfNeeded();
    }

    function _initIfNeeded() internal {
        if (!FHE.isInitialized()) {
            FHE.initialize();
        }
    }

    function _requireInitialized() internal view {
        if (!FHE.isInitialized()) {
            revert InvalidState(); 
        }
    }

    function addProvider(address _provider) external onlyOwner whenNotPaused {
        providers[_provider] = true;
        emit ProviderAdded(_provider);
    }

    function removeProvider(address _provider) external onlyOwner whenNotPaused {
        providers[_provider] = false;
        emit ProviderRemoved(_provider);
    }

    function pause() external onlyOwner {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }

    function setCooldownSeconds(uint256 _cooldownSeconds) external onlyOwner {
        if (_cooldownSeconds == 0) revert InvalidArgument();
        cooldownSeconds = _cooldownSeconds;
        emit CooldownSet(_cooldownSeconds);
    }

    function openBatch() external onlyOwner whenNotPaused {
        uint32 newBatchId = uint32(batches.length);
        batches[newBatchId] = Batch({id: newBatchId, open: true});
        emit BatchOpened(newBatchId);
    }

    function closeBatch(uint32 _batchId) external onlyOwner whenNotPaused {
        if (_batchId >= batches.length) revert InvalidBatch();
        Batch storage batch = batches[_batchId];
        if (!batch.open) revert BatchClosed();
        batch.open = false;
        emit BatchClosed(_batchId);
    }

    function submitContribution(
        uint32 _batchId,
        bytes32 _contributionId,
        euint32 _skillScore,
        euint32 _contributionScore
    ) external onlyProvider whenNotPaused checkSubmissionCooldown {
        if (_batchId >= batches.length) revert InvalidBatch();
        if (!batches[_batchId].open) revert BatchClosed();
        if (contributions[_contributionId].exists) revert InvalidArgument(); 

        _initIfNeeded();

        euint32 totalScore = _skillScore.add(_contributionScore);

        contributions[_contributionId] = SkillContribution({
            skillScore: _skillScore,
            contributionScore: _contributionScore,
            totalScore: totalScore,
            exists: true
        });

        lastSubmissionTime[msg.sender] = block.timestamp;
        emit ContributionSubmitted(msg.sender, _batchId, _contributionId);
    }

    function _hashCiphertexts(bytes32[] memory cts) internal pure returns (bytes32) {
        return keccak256(abi.encode(cts, address(this)));
    }

    function requestBatchScoreDecryption(uint32 _batchId)
        external
        onlyOwner
        whenNotPaused
        checkDecryptionCooldown
    {
        if (_batchId >= batches.length) revert InvalidBatch();
        if (batches[_batchId].open) revert InvalidBatch(); 

        _requireInitialized();

        bytes32[] memory cts = new bytes32[](1);
        euint32 totalScoreSum = FHE.asEuint32(0);

        for (uint256 i = 0; i < batches.length; i++) { 
            if (batches[uint32(i)].id == _batchId) {
                uint256 count;
                for (uint256 j = 0; j < batches.length; j++) { 
                    if (batches[uint32(j)].id == _batchId) {
                        count++;
                    }
                }
                if (count > 0) {
                    totalScoreSum = FHE.asEuint32(uint32(count)); 
                }
                break;
            }
        }
        cts[0] = FHE.toBytes32(totalScoreSum);

        bytes32 stateHash = _hashCiphertexts(cts);
        uint256 requestId = FHE.requestDecryption(cts, this.myCallback.selector);

        decryptionContexts[requestId] = DecryptionContext({
            batchId: _batchId,
            stateHash: stateHash,
            processed: false
        });

        lastDecryptionRequestTime[msg.sender] = block.timestamp;
        emit DecryptionRequested(requestId, _batchId);
    }

    function myCallback(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory proof
    ) public {
        if (decryptionContexts[requestId].processed) revert ReplayDetected();
        if (cleartexts.length != 32) revert DecryptionFailed(); 

        bytes32[] memory cts = new bytes32[](1);
        uint32 currentBatchId = decryptionContexts[requestId].batchId;
        euint32 totalScoreSum = FHE.asEuint32(0);

        for (uint256 i = 0; i < batches.length; i++) { 
            if (batches[uint32(i)].id == currentBatchId) {
                uint256 count;
                for (uint256 j = 0; j < batches.length; j++) { 
                    if (batches[uint32(j)].id == currentBatchId) {
                        count++;
                    }
                }
                if (count > 0) {
                    totalScoreSum = FHE.asEuint32(uint32(count)); 
                }
                break;
            }
        }
        cts[0] = FHE.toBytes32(totalScoreSum);

        bytes32 currentHash = _hashCiphertexts(cts);
        if (currentHash != decryptionContexts[requestId].stateHash) {
            revert StateMismatch();
        }

        try FHE.checkSignatures(requestId, cleartexts, proof) {
            uint256 decryptedTotalScoreSum = abi.decode(cleartexts, (uint256));

            decryptionContexts[requestId].processed = true;
            emit DecryptionCompleted(requestId, currentBatchId, decryptedTotalScoreSum);
        } catch {
            revert DecryptionFailed();
        }
    }
}