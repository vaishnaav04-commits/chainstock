
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title WarehouseLedger
 * @notice QR-triggered warehouse inventory and movement history.
 * @dev Tracks whole pallets/boxes, not partial stock balances.
 *      Solidity state and emitted events form the audit trail.
 */
contract WarehouseLedger is AccessControl, Pausable {
    // ---------------------------------------------------------
    // ACCESS CONTROL
    // ---------------------------------------------------------

    bytes32 public constant ADMIN_ROLE =
        keccak256("ADMIN_ROLE");

    bytes32 public constant MANAGER_ROLE =
        keccak256("MANAGER_ROLE");

    bytes32 public constant OPERATOR_ROLE =
        keccak256("OPERATOR_ROLE");

    bytes32 public constant VIEWER_ROLE =
        keccak256("VIEWER_ROLE");

    uint256 public constant MAX_BATCH_SIZE = 25;

    // ---------------------------------------------------------
    // INVENTORY STATUS
    // ---------------------------------------------------------

    // Do not change this ordering after deployment.
    // The frontend will use these numeric values.
    enum Status {
        Received,    // 0
        Stored,      // 1
        Picked,      // 2
        InTransit,   // 3
        Shipped,     // 4
        Delivered,   // 5
        Damaged,     // 6
        Returned     // 7
    }

    // ---------------------------------------------------------
    // DATA STRUCTURES
    // ---------------------------------------------------------

    struct Item {
        string itemId;
        string name;
        string category;
        string sku;
        uint256 quantity;
        string unit;
        string currentZone;
        Status status;
        bytes32 metadataHash;
        uint64 createdAt;
        uint64 updatedAt;
        bool exists;
    }

    struct Movement {
        string toZone;
        Status status;
        uint256 quantity;
        uint64 timestamp;
        address actor;
        string note;
    }

    struct MovementInput {
        string itemId;
        string toZone;
        Status status;
        uint256 quantity;
        string note;
    }

    // ---------------------------------------------------------
    // STORAGE
    // ---------------------------------------------------------

    mapping(bytes32 => Item) private items;

    mapping(bytes32 => Movement[]) private histories;

    string[] private itemIds;
    string[] private zoneNames;

    mapping(bytes32 => bool) public zoneExists;
    mapping(bytes32 => bool) public zoneActive;

    mapping(Status => mapping(Status => bool))
        public allowedStatusTransitions;

    mapping(bytes32 => mapping(bytes32 => bool))
        public allowedZoneTransitions;

    // ---------------------------------------------------------
    // CUSTOM ERRORS
    // ---------------------------------------------------------

    error EmptyField(string field);
    error FieldTooLong(string field, uint256 maximum);
    error ZeroQuantity();
    error ItemAlreadyExists(string itemId);
    error ItemNotFound(string itemId);
    error InvalidQuantity(
        uint256 provided,
        uint256 expected
    );
    error InvalidStatusTransition(
        Status from,
        Status to
    );
    error InvalidZoneTransition(
        string from,
        string to
    );
    error UnknownZone(string zone);
    error InactiveZone(string zone);
    error ZoneAlreadyExists(string zone);
    error UnauthorizedActor(address actor);
    error InvalidBatchSize(uint256 size);
    error NoStateChange();

    // ---------------------------------------------------------
    // EVENTS
    // ---------------------------------------------------------

    event ItemRegistered(
        string indexed itemId,
        address indexed actor,
        string initialZone,
        uint256 quantity,
        uint256 timestamp
    );

    event MovementLogged(
        string indexed itemId,
        address indexed actor,
        string fromZone,
        string toZone,
        Status status,
        uint256 quantity,
        uint256 timestamp
    );

    // RoleGranted and RoleRevoked are inherited
    // from OpenZeppelin AccessControl.

    event ZoneAdded(string zone);

    event ZoneActivityChanged(
        string zone,
        bool active
    );

    event StatusTransitionUpdated(
        Status from,
        Status to,
        bool allowed
    );

    event ZoneTransitionUpdated(
        string from,
        string to,
        bool allowed
    );

    // ---------------------------------------------------------
    // CONSTRUCTOR
    // ---------------------------------------------------------

    constructor() {
        // The deploying wallet becomes the initial admin.
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _grantRole(VIEWER_ROLE, msg.sender);

        // Install the initial warehouse layout.
        _addZone("Receiving");
        _addZone("Storage A");
        _addZone("Storage B");
        _addZone("Storage C");
        _addZone("Packing");
        _addZone("Dispatch");

        // Configure valid status changes.
        _allowStatus(Status.Received, Status.Stored);
        _allowStatus(Status.Received, Status.Damaged);

        _allowStatus(Status.Stored, Status.Picked);
        _allowStatus(Status.Stored, Status.Damaged);

        _allowStatus(Status.Picked, Status.InTransit);
        _allowStatus(Status.Picked, Status.Damaged);

        _allowStatus(Status.InTransit, Status.Shipped);
        _allowStatus(Status.InTransit, Status.Damaged);

        _allowStatus(Status.Shipped, Status.Delivered);
        _allowStatus(Status.Shipped, Status.Returned);

        _allowStatus(Status.Delivered, Status.Returned);

        _allowStatus(Status.Damaged, Status.Returned);
        _allowStatus(Status.Returned, Status.Stored);

        // Configure basic warehouse routes.
        for (uint256 i = 1; i <= 3; i++) {
            _allowZone("Receiving", zoneNames[i]);
            _allowZone(zoneNames[i], "Packing");

            // Storage-to-storage transfers are valid.
            for (uint256 j = 1; j <= 3; j++) {
                if (i != j) {
                    _allowZone(zoneNames[i], zoneNames[j]);
                }
            }
        }

        _allowZone("Packing", "Dispatch");

        // A returned item can re-enter Receiving.
        _allowZone("Dispatch", "Receiving");
    }

    // ---------------------------------------------------------
    // INPUT VALIDATION
    // ---------------------------------------------------------

    function _validateText(
        string memory value,
        string memory field,
        uint256 maxLength
    ) internal pure {
        uint256 length = bytes(value).length;

        if (length == 0) {
            revert EmptyField(field);
        }

        if (length > maxLength) {
            revert FieldTooLong(field, maxLength);
        }
    }

    function _itemKey(
        string memory itemId
    ) internal pure returns (bytes32) {
        return keccak256(bytes(itemId));
    }

    function _zoneKey(
        string memory zone
    ) internal pure returns (bytes32) {
        return keccak256(bytes(zone));
    }

    function _requireMovementRole() internal view {
        if (
            !hasRole(OPERATOR_ROLE, msg.sender) &&
            !hasRole(MANAGER_ROLE, msg.sender) &&
            !hasRole(ADMIN_ROLE, msg.sender)
        ) {
            revert UnauthorizedActor(msg.sender);
        }
    }

    function _requireRegistrationRole() internal view {
        if (
            !hasRole(MANAGER_ROLE, msg.sender) &&
            !hasRole(ADMIN_ROLE, msg.sender)
        ) {
            revert UnauthorizedActor(msg.sender);
        }
    }

    function _requireActiveZone(
        string memory zone
    ) internal view {
        bytes32 key = _zoneKey(zone);

        if (!zoneExists[key]) {
            revert UnknownZone(zone);
        }

        if (!zoneActive[key]) {
            revert InactiveZone(zone);
        }
    }

    // ---------------------------------------------------------
    // REGISTER INVENTORY
    // ---------------------------------------------------------

    /**
     * @notice Register a new pallet or box.
     * @dev Registration also creates its first history entry.
     *      Items start in Received status.
     */
    function registerItem(
        string calldata itemId,
        string calldata name,
        string calldata category,
        string calldata sku,
        uint256 quantity,
        string calldata unit,
        string calldata initialZone,
        bytes32 metadataHash
    ) external whenNotPaused {
        _requireRegistrationRole();

        _validateText(itemId, "itemId", 64);
        _validateText(name, "name", 128);
        _validateText(category, "category", 64);
        _validateText(sku, "sku", 64);
        _validateText(unit, "unit", 32);
        _validateText(initialZone, "initialZone", 64);

        if (quantity == 0) {
            revert ZeroQuantity();
        }

        _requireActiveZone(initialZone);

        bytes32 key = _itemKey(itemId);

        if (items[key].exists) {
            revert ItemAlreadyExists(itemId);
        }

        uint64 nowTime = uint64(block.timestamp);

        // Store the current inventory state.
        items[key] = Item({
            itemId: itemId,
            name: name,
            category: category,
            sku: sku,
            quantity: quantity,
            unit: unit,
            currentZone: initialZone,
            status: Status.Received,
            metadataHash: metadataHash,
            createdAt: nowTime,
            updatedAt: nowTime,
            exists: true
        });

        itemIds.push(itemId);

        // The first record becomes part of the audit trail.
        histories[key].push(
            Movement({
                toZone: initialZone,
                status: Status.Received,
                quantity: quantity,
                timestamp: nowTime,
                actor: msg.sender,
                note: "Item registered"
            })
        );

        emit ItemRegistered(
            itemId,
            msg.sender,
            initialZone,
            quantity,
            block.timestamp
        );

        emit MovementLogged(
            itemId,
            msg.sender,
            "",
            initialZone,
            Status.Received,
            quantity,
            block.timestamp
        );
    }

    // ---------------------------------------------------------
    // LOG A MOVEMENT
    // ---------------------------------------------------------

    /**
     * @notice Record an authorized pallet movement.
     * @dev Invalid state or zone transitions are rejected.
     */
    function logMovement(
        string calldata itemId,
        string calldata toZone,
        Status status,
        uint256 quantity,
        string calldata note
    ) external whenNotPaused {
        _requireMovementRole();

        _logMovement(
            itemId,
            toZone,
            status,
            quantity,
            note
        );
    }

    /**
     * @notice Process up to 25 QR movements together.
     * @dev The entire transaction reverts if any entry
     *      is invalid. No partial batch is committed.
     */
    function batchLogMovement(
        MovementInput[] calldata movements
    ) external whenNotPaused {
        _requireMovementRole();

        uint256 length = movements.length;

        if (length == 0 || length > MAX_BATCH_SIZE) {
            revert InvalidBatchSize(length);
        }

        for (uint256 i = 0; i < length; i++) {
            MovementInput calldata m = movements[i];

            _logMovement(
                m.itemId,
                m.toZone,
                m.status,
                m.quantity,
                m.note
            );
        }
    }

    /**
     * @dev Shared movement engine for single and batch scans.
     */
    function _logMovement(
        string memory itemId,
        string memory toZone,
        Status newStatus,
        uint256 quantity,
        string memory note
    ) internal {
        _validateText(itemId, "itemId", 64);
        _validateText(toZone, "toZone", 64);

        if (bytes(note).length > 256) {
            revert FieldTooLong("note", 256);
        }

        bytes32 key = _itemKey(itemId);

        Item storage item = items[key];

        if (!item.exists) {
            revert ItemNotFound(itemId);
        }

        _requireActiveZone(toZone);

        // Whole-pallet model: no partial quantity movement.
        if (quantity != item.quantity) {
            revert InvalidQuantity(quantity, item.quantity);
        }

        bool sameZone =
            _zoneKey(item.currentZone) == _zoneKey(toZone);

        bool sameStatus = item.status == newStatus;

        // Do not generate fake no-op history entries.
        if (sameZone && sameStatus) {
            revert NoStateChange();
        }

        // Same status is allowed for a valid zone transfer.
        // A status change must follow the workflow graph.
        if (
            !sameStatus &&
            !allowedStatusTransitions[item.status][newStatus]
        ) {
            revert InvalidStatusTransition(
                item.status,
                newStatus
            );
        }

        // A zone transfer must follow an approved route.
        if (
            !sameZone &&
            !allowedZoneTransitions[
                _zoneKey(item.currentZone)
            ][_zoneKey(toZone)]
        ) {
            revert InvalidZoneTransition(
                item.currentZone,
                toZone
            );
        }

        string memory previousZone = item.currentZone;

        uint64 nowTime = uint64(block.timestamp);

        item.currentZone = toZone;
        item.status = newStatus;
        item.updatedAt = nowTime;

        // Historical entries are appended, never overwritten.
        histories[key].push(
            Movement({
                toZone: toZone,
                status: newStatus,
                quantity: quantity,
                timestamp: nowTime,
                actor: msg.sender,
                note: note
            })
        );

        emit MovementLogged(
            itemId,
            msg.sender,
            previousZone,
            toZone,
            newStatus,
            quantity,
            block.timestamp
        );
    }

    // ---------------------------------------------------------
    // READ INVENTORY AND HISTORY
    // ---------------------------------------------------------

    function getItem(
        string calldata itemId
    ) external view returns (Item memory) {
        bytes32 key = _itemKey(itemId);

        if (!items[key].exists) {
            revert ItemNotFound(itemId);
        }

        return items[key];
    }

    function getHistory(
        string calldata itemId
    ) external view returns (Movement[] memory) {
        bytes32 key = _itemKey(itemId);

        if (!items[key].exists) {
            revert ItemNotFound(itemId);
        }

        return histories[key];
    }

    function getAllItemIds()
        external
        view
        returns (string[] memory)
    {
        return itemIds;
    }

    function getItemCount()
        external
        view
        returns (uint256)
    {
        return itemIds.length;
    }

    function getHistoryCount(
        string calldata itemId
    ) external view returns (uint256) {
        bytes32 key = _itemKey(itemId);

        if (!items[key].exists) {
            revert ItemNotFound(itemId);
        }

        return histories[key].length;
    }

    /**
     * @notice Returns items currently in a warehouse zone.
     * @dev This is an O(n) view intended for small datasets.
     *      Larger deployments should use an event indexer.
     */
    function getItemsByZone(
        string calldata zone
    ) external view returns (string[] memory) {
        bytes32 target = _zoneKey(zone);
        uint256 count = 0;

        for (uint256 i = 0; i < itemIds.length; i++) {
            bytes32 key = _itemKey(itemIds[i]);

            if (_zoneKey(items[key].currentZone) == target) {
                count++;
            }
        }

        string[] memory result = new string[](count);

        uint256 index = 0;

        for (uint256 i = 0; i < itemIds.length; i++) {
            bytes32 key = _itemKey(itemIds[i]);

            if (_zoneKey(items[key].currentZone) == target) {
                result[index] = itemIds[i];
                index++;
            }
        }

        return result;
    }

    // ---------------------------------------------------------
    // WAREHOUSE ZONE MANAGEMENT
    // ---------------------------------------------------------

    function addZone(
        string calldata zone
    ) external onlyRole(ADMIN_ROLE) {
        _addZone(zone);
    }

    function _addZone(string memory zone) internal {
        _validateText(zone, "zone", 64);

        bytes32 key = _zoneKey(zone);

        if (zoneExists[key]) {
            revert ZoneAlreadyExists(zone);
        }

        zoneExists[key] = true;
        zoneActive[key] = true;
        zoneNames.push(zone);

        emit ZoneAdded(zone);
    }

    function setZoneActive(
        string calldata zone,
        bool active
    ) external onlyRole(ADMIN_ROLE) {
        bytes32 key = _zoneKey(zone);

        if (!zoneExists[key]) {
            revert UnknownZone(zone);
        }

        zoneActive[key] = active;

        emit ZoneActivityChanged(zone, active);
    }

    function getZones()
        external
        view
        returns (string[] memory)
    {
        return zoneNames;
    }

    // ---------------------------------------------------------
    // WORKFLOW CONFIGURATION
    // ---------------------------------------------------------

    function setAllowedStatusTransition(
        Status from,
        Status to,
        bool allowed
    ) external onlyRole(ADMIN_ROLE) {
        allowedStatusTransitions[from][to] = allowed;

        emit StatusTransitionUpdated(from, to, allowed);
    }

    function _allowStatus(
        Status from,
        Status to
    ) internal {
        allowedStatusTransitions[from][to] = true;

        emit StatusTransitionUpdated(from, to, true);
    }

    function setAllowedZoneTransition(
        string calldata from,
        string calldata to,
        bool allowed
    ) external onlyRole(ADMIN_ROLE) {
        if (!zoneExists[_zoneKey(from)]) {
            revert UnknownZone(from);
        }

        if (!zoneExists[_zoneKey(to)]) {
            revert UnknownZone(to);
        }

        _setZoneTransition(from, to, allowed);
    }

    function _setZoneTransition(
        string memory from,
        string memory to,
        bool allowed
    ) internal {
        allowedZoneTransitions[
            _zoneKey(from)
        ][_zoneKey(to)] = allowed;

        emit ZoneTransitionUpdated(from, to, allowed);
    }

    function _allowZone(
        string memory from,
        string memory to
    ) internal {
        _setZoneTransition(from, to, true);
    }

    function isZoneTransitionAllowed(
        string calldata from,
        string calldata to
    ) external view returns (bool) {
        return allowedZoneTransitions[
            _zoneKey(from)
        ][_zoneKey(to)];
    }

    // ---------------------------------------------------------
    // EMERGENCY ADMINISTRATIVE CONTROLS
    // ---------------------------------------------------------

    function pause()
        external
        onlyRole(ADMIN_ROLE)
    {
        _pause();
    }

    function unpause()
        external
        onlyRole(ADMIN_ROLE)
    {
        _unpause();
    }

    // ---------------------------------------------------------
    // INTERFACE SUPPORT
    // ---------------------------------------------------------

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
