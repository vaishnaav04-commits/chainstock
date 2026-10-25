
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ChainStock - WarehouseLedger", function () {
  let ledger;
  let admin;
  let manager;
  let operator;
  let viewer;
  let outsider;

  // Matches the Solidity Status enum exactly.
  const Status = Object.freeze({
    Received: 0,
    Stored: 1,
    Picked: 2,
    InTransit: 3,
    Shipped: 4,
    Delivered: 5,
    Damaged: 6,
    Returned: 7,
  });

  const ZERO_HASH = ethers.ZeroHash;

  // Deploy a fresh contract for each test.
  // This keeps every test independent.
  beforeEach(async function () {
    [admin, manager, operator, viewer, outsider] =
      await ethers.getSigners();

    const WarehouseLedger =
      await ethers.getContractFactory("WarehouseLedger");

    ledger = await WarehouseLedger.deploy();
    await ledger.waitForDeployment();
  });

  // Helper: create a sample warehouse item.
  async function registerSample(
    id = "PALLET001",
    signer = admin,
  ) {
    const tx = await ledger.connect(signer).registerItem(
      id,
      "Industrial Bearings",
      "Mechanical Parts",
      "BRG-001",
      50,
      "pieces",
      "Receiving",
      ZERO_HASH,
    );

    await tx.wait();
  }

  // Helper: move the sample item.
  async function move(
    id,
    zone,
    status,
    signer = admin,
    quantity = 50,
    note = "Automated test movement",
  ) {
    return ledger.connect(signer).logMovement(
      id,
      zone,
      status,
      quantity,
      note,
    );
  }

  // Grant an operational role to a wallet.
  async function grant(role, signer) {
    const tx = await ledger
      .connect(admin)
      .grantRole(role, signer.address);

    await tx.wait();
  }

  describe("1. Deployment and roles", function () {
    it("deploys with the correct administrator", async function () {
      const adminRole = await ledger.ADMIN_ROLE();
      const defaultAdmin = await ledger.DEFAULT_ADMIN_ROLE();

      expect(
        await ledger.hasRole(adminRole, admin.address),
      ).to.equal(true);

      expect(
        await ledger.hasRole(defaultAdmin, admin.address),
      ).to.equal(true);
    });

    it("gives the deployer operational roles", async function () {
      expect(
        await ledger.hasRole(
          await ledger.MANAGER_ROLE(),
          admin.address,
        ),
      ).to.equal(true);

      expect(
        await ledger.hasRole(
          await ledger.OPERATOR_ROLE(),
          admin.address,
        ),
      ).to.equal(true);

      expect(
        await ledger.hasRole(
          await ledger.VIEWER_ROLE(),
          admin.address,
        ),
      ).to.equal(true);
    });

    it("starts with six warehouse zones", async function () {
      const zones = await ledger.getZones();

      expect(zones.length).to.equal(6);
      expect(zones).to.include("Receiving");
      expect(zones).to.include("Storage A");
      expect(zones).to.include("Packing");
      expect(zones).to.include("Dispatch");
    });

    it("rejects role grants from non-admin wallets", async function () {
      await expect(
        ledger
          .connect(outsider)
          .grantRole(
            await ledger.OPERATOR_ROLE(),
            viewer.address,
          ),
      ).to.be.revertedWithCustomError(
        ledger,
        "AccessControlUnauthorizedAccount",
      );
    });

    it("allows admins to grant and revoke roles", async function () {
      const role = await ledger.OPERATOR_ROLE();

      await expect(
        ledger.connect(admin).grantRole(role, operator.address),
      ).to.emit(ledger, "RoleGranted");

      expect(
        await ledger.hasRole(role, operator.address),
      ).to.equal(true);

      await ledger.connect(admin).revokeRole(
        role,
        operator.address,
      );

      expect(
        await ledger.hasRole(role, operator.address),
      ).to.equal(false);
    });
  });

  describe("2. Register inventory", function () {
    it("registers an item successfully", async function () {
      await expect(
        ledger.registerItem(
          "PALLET001",
          "Industrial Bearings",
          "Mechanical Parts",
          "BRG-001",
          50,
          "pieces",
          "Receiving",
          ZERO_HASH,
        ),
      ).to.emit(ledger, "ItemRegistered");

      const item = await ledger.getItem("PALLET001");

      expect(item.itemId).to.equal("PALLET001");
      expect(item.name).to.equal("Industrial Bearings");
      expect(item.sku).to.equal("BRG-001");
      expect(item.quantity).to.equal(50n);
      expect(item.currentZone).to.equal("Receiving");
      expect(item.status).to.equal(BigInt(Status.Received));
      expect(item.exists).to.equal(true);
    });

    it("creates initial history during registration", async function () {
      await registerSample();

      const history = await ledger.getHistory("PALLET001");

      expect(history.length).to.equal(1);
      expect(history[0].toZone).to.equal("Receiving");
      expect(history[0].status).to.equal(0n);
      expect(history[0].actor).to.equal(admin.address);
      expect(history[0].note).to.equal("Item registered");
    });

    it("prevents duplicate registration", async function () {
      await registerSample();

      await expect(
        registerSample(),
      ).to.be.revertedWithCustomError(
        ledger,
        "ItemAlreadyExists",
      );
    });

    it("rejects zero quantity", async function () {
      await expect(
        ledger.registerItem(
          "PALLET002",
          "Sample Product",
          "General",
          "SKU-002",
          0,
          "pieces",
          "Receiving",
          ZERO_HASH,
        ),
      ).to.be.revertedWithCustomError(
        ledger,
        "ZeroQuantity",
      );
    });

    it("rejects empty item IDs", async function () {
      await expect(
        ledger.registerItem(
          "",
          "Sample Product",
          "General",
          "SKU-002",
          10,
          "pieces",
          "Receiving",
          ZERO_HASH,
        ),
      ).to.be.revertedWithCustomError(
        ledger,
        "EmptyField",
      );
    });

    it("rejects unknown registration zones", async function () {
      await expect(
        ledger.registerItem(
          "PALLET002",
          "Sample Product",
          "General",
          "SKU-002",
          10,
          "pieces",
          "Unknown Zone",
          ZERO_HASH,
        ),
      ).to.be.revertedWithCustomError(
        ledger,
        "UnknownZone",
      );
    });

    it("allows managers to register inventory", async function () {
      await grant(await ledger.MANAGER_ROLE(), manager);

      await registerSample("PALLET002", manager);

      expect(await ledger.getItemCount()).to.equal(1n);
    });

    it("prevents operators and outsiders from registering", async function () {
      await grant(await ledger.OPERATOR_ROLE(), operator);

      await expect(
        registerSample("PALLET002", operator),
      ).to.be.revertedWithCustomError(
        ledger,
        "UnauthorizedActor",
      );

      await expect(
        registerSample("PALLET003", outsider),
      ).to.be.revertedWithCustomError(
        ledger,
        "UnauthorizedActor",
      );
    });
  });

  describe("3. Warehouse movements", function () {
    beforeEach(async function () {
      await registerSample();
    });

    it("accepts Received to Stored", async function () {
      await expect(
        move("PALLET001", "Storage A", Status.Stored),
      ).to.emit(ledger, "MovementLogged");

      const item = await ledger.getItem("PALLET001");

      expect(item.status).to.equal(1n);
      expect(item.currentZone).to.equal("Storage A");

      const history = await ledger.getHistory("PALLET001");

      expect(history.length).to.equal(2);
    });

    it("rejects invalid status transitions", async function () {
      await expect(
        move("PALLET001", "Receiving", Status.Delivered),
      ).to.be.revertedWithCustomError(
        ledger,
        "InvalidStatusTransition",
      );

      expect(await ledger.getHistoryCount("PALLET001"))
        .to.equal(1n);
    });

    it("rejects invalid zone transitions", async function () {
      await expect(
        move("PALLET001", "Dispatch", Status.Stored),
      ).to.be.revertedWithCustomError(
        ledger,
        "InvalidZoneTransition",
      );
    });

    it("rejects incorrect quantities", async function () {
      await expect(
        move("PALLET001", "Storage A", Status.Stored, admin, 10),
      ).to.be.revertedWithCustomError(
        ledger,
        "InvalidQuantity",
      );
    });

    it("rejects a no-op movement", async function () {
      await expect(
        move("PALLET001", "Receiving", Status.Received),
      ).to.be.revertedWithCustomError(
        ledger,
        "NoStateChange",
      );
    });

    it("permits an authorized operator to move items", async function () {
      await grant(await ledger.OPERATOR_ROLE(), operator);

      await move(
        "PALLET001",
        "Storage A",
        Status.Stored,
        operator,
      );

      const history = await ledger.getHistory("PALLET001");

      expect(history[1].actor).to.equal(operator.address);
    });

    it("rejects movements by unauthorized wallets", async function () {
      await expect(
        move(
          "PALLET001",
          "Storage A",
          Status.Stored,
          outsider,
        ),
      ).to.be.revertedWithCustomError(
        ledger,
        "UnauthorizedActor",
      );
    });

    it("allows viewers to read but not write", async function () {
      await grant(await ledger.VIEWER_ROLE(), viewer);

      const item = await ledger.connect(viewer).getItem(
        "PALLET001",
      );

      expect(item.itemId).to.equal("PALLET001");

      await expect(
        move("PALLET001", "Storage A", Status.Stored, viewer),
      ).to.be.revertedWithCustomError(
        ledger,
        "UnauthorizedActor",
      );
    });

    it("rejects unknown item movement", async function () {
      await expect(
        move("NOT_FOUND", "Storage A", Status.Stored),
      ).to.be.revertedWithCustomError(
        ledger,
        "ItemNotFound",
      );
    });

    it("supports a complete valid warehouse journey", async function () {
      await move("PALLET001", "Storage A", Status.Stored);

      await move("PALLET001", "Storage A", Status.Picked);

      await move("PALLET001", "Packing", Status.InTransit);

      await move("PALLET001", "Dispatch", Status.Shipped);

      await move("PALLET001", "Dispatch", Status.Delivered);

      const item = await ledger.getItem("PALLET001");

      expect(item.status).to.equal(BigInt(Status.Delivered));
      expect(item.currentZone).to.equal("Dispatch");

      // Registration plus five movements.
      expect(
        await ledger.getHistoryCount("PALLET001"),
      ).to.equal(6n);
    });

    it("rejects Delivered to Stored", async function () {
      await move("PALLET001", "Storage A", Status.Stored);
      await move("PALLET001", "Storage A", Status.Picked);
      await move("PALLET001", "Packing", Status.InTransit);
      await move("PALLET001", "Dispatch", Status.Shipped);
      await move("PALLET001", "Dispatch", Status.Delivered);

      await expect(
        move("PALLET001", "Dispatch", Status.Stored),
      ).to.be.revertedWithCustomError(
        ledger,
        "InvalidStatusTransition",
      );
    });
  });

  describe("4. Append-only audit history", function () {
    it("keeps old history unchanged after new movements", async function () {
      await registerSample();

      const original = await ledger.getHistory("PALLET001");
      const first = original[0];

      await move("PALLET001", "Storage A", Status.Stored);

      const updated = await ledger.getHistory("PALLET001");

      expect(updated.length).to.equal(2);
      expect(updated[0].toZone).to.equal(first.toZone);
      expect(updated[0].status).to.equal(first.status);
      expect(updated[0].actor).to.equal(first.actor);
      expect(updated[0].timestamp).to.equal(first.timestamp);
      expect(updated[0].note).to.equal(first.note);
    });

    it("records a timestamp and wallet for every entry", async function () {
      await registerSample();
      await move("PALLET001", "Storage A", Status.Stored);

      const history = await ledger.getHistory("PALLET001");

      for (const entry of history) {
        expect(entry.timestamp).to.be.greaterThan(0n);
        expect(entry.actor).to.equal(admin.address);
      }
    });

    it("returns item IDs and zone inventories", async function () {
      await registerSample("PALLET001");
      await registerSample("PALLET002");

      await move("PALLET001", "Storage A", Status.Stored);

      expect(await ledger.getItemCount()).to.equal(2n);

      const ids = await ledger.getAllItemIds();
      const storage = await ledger.getItemsByZone("Storage A");
      const receiving = await ledger.getItemsByZone("Receiving");

      expect(ids).to.include("PALLET001");
      expect(ids).to.include("PALLET002");
      expect(storage).to.deep.equal(["PALLET001"]);
      expect(receiving).to.deep.equal(["PALLET002"]);
    });
  });

  describe("5. Batch QR scanning", function () {
    beforeEach(async function () {
      await registerSample("PALLET001");
      await registerSample("PALLET002");
    });

    it("records multiple movements in one transaction", async function () {
      const batch = [
        {
          itemId: "PALLET001",
          toZone: "Storage A",
          status: Status.Stored,
          quantity: 50,
          note: "Batch scan 1",
        },
        {
          itemId: "PALLET002",
          toZone: "Storage B",
          status: Status.Stored,
          quantity: 50,
          note: "Batch scan 2",
        },
      ];

      const tx = await ledger.batchLogMovement(batch);
      const receipt = await tx.wait();

      expect(receipt.status).to.equal(1);

      const first = await ledger.getItem("PALLET001");
      const second = await ledger.getItem("PALLET002");

      expect(first.currentZone).to.equal("Storage A");
      expect(second.currentZone).to.equal("Storage B");

      expect(
        await ledger.getHistoryCount("PALLET001"),
      ).to.equal(2n);

      expect(
        await ledger.getHistoryCount("PALLET002"),
      ).to.equal(2n);
    });

    it("rolls back the entire batch if one scan is invalid", async function () {
      const batch = [
        {
          itemId: "PALLET001",
          toZone: "Storage A",
          status: Status.Stored,
          quantity: 50,
          note: "Valid scan",
        },
        {
          itemId: "PALLET002",
          toZone: "Dispatch",
          status: Status.Delivered,
          quantity: 50,
          note: "Invalid scan",
        },
      ];

      await expect(
        ledger.batchLogMovement(batch),
      ).to.be.revertedWithCustomError(
        ledger,
        "InvalidStatusTransition",
      );

      // Even the first valid scan was not committed.
      expect(
        (await ledger.getItem("PALLET001")).currentZone,
      ).to.equal("Receiving");

      expect(
        await ledger.getHistoryCount("PALLET001"),
      ).to.equal(1n);

      expect(
        await ledger.getHistoryCount("PALLET002"),
      ).to.equal(1n);
    });

    it("rejects empty batches", async function () {
      await expect(
        ledger.batchLogMovement([]),
      ).to.be.revertedWithCustomError(
        ledger,
        "InvalidBatchSize",
      );
    });

    it("rejects batches larger than 25", async function () {
      const batch = Array.from({ length: 26 }, () => ({
        itemId: "PALLET001",
        toZone: "Storage A",
        status: Status.Stored,
        quantity: 50,
        note: "Overflow batch",
      }));

      await expect(
        ledger.batchLogMovement(batch),
      ).to.be.revertedWithCustomError(
        ledger,
        "InvalidBatchSize",
      );
    });

    it("rejects batches submitted by outsiders", async function () {
      const batch = [
        {
          itemId: "PALLET001",
          toZone: "Storage A",
          status: Status.Stored,
          quantity: 50,
          note: "Unauthorized scan",
        },
      ];

      await expect(
        ledger.connect(outsider).batchLogMovement(batch),
      ).to.be.revertedWithCustomError(
        ledger,
        "UnauthorizedActor",
      );
    });
  });

  describe("6. Zone administration", function () {
    it("lets the admin create zones", async function () {
      await expect(
        ledger.addZone("Cold Storage"),
      ).to.emit(ledger, "ZoneAdded");

      const zones = await ledger.getZones();

      expect(zones).to.include("Cold Storage");
    });

    it("prevents duplicate zones", async function () {
      await expect(
        ledger.addZone("Receiving"),
      ).to.be.revertedWithCustomError(
        ledger,
        "ZoneAlreadyExists",
      );
    });

    it("prevents operators from adding zones", async function () {
      await grant(await ledger.OPERATOR_ROLE(), operator);

      await expect(
        ledger.connect(operator).addZone("Cold Storage"),
      ).to.be.revertedWithCustomError(
        ledger,
        "AccessControlUnauthorizedAccount",
      );
    });

    it("rejects movements into inactive zones", async function () {
      await registerSample();

      await ledger.setZoneActive("Storage A", false);

      await expect(
        move("PALLET001", "Storage A", Status.Stored),
      ).to.be.revertedWithCustomError(
        ledger,
        "InactiveZone",
      );
    });

    it("allows admins to configure new zone routes", async function () {
      await ledger.addZone("Cold Storage");

      await ledger.setAllowedZoneTransition(
        "Receiving",
        "Cold Storage",
        true,
      );

      expect(
        await ledger.isZoneTransitionAllowed(
          "Receiving",
          "Cold Storage",
        ),
      ).to.equal(true);

      await registerSample();

      await move(
        "PALLET001",
        "Cold Storage",
        Status.Stored,
      );

      const item = await ledger.getItem("PALLET001");

      expect(item.currentZone).to.equal("Cold Storage");
    });

    it("allows admins to configure status transitions", async function () {
      await registerSample();

      await expect(
        move("PALLET001", "Receiving", Status.Returned),
      ).to.be.revertedWithCustomError(
        ledger,
        "InvalidStatusTransition",
      );

      await ledger.setAllowedStatusTransition(
        Status.Received,
        Status.Returned,
        true,
      );

      await move(
        "PALLET001",
        "Receiving",
        Status.Returned,
      );

      expect(
        (await ledger.getItem("PALLET001")).status,
      ).to.equal(BigInt(Status.Returned));
    });
  });

  describe("7. Emergency pause", function () {
    it("allows the admin to pause the contract", async function () {
      await ledger.pause();

      expect(await ledger.paused()).to.equal(true);
    });

    it("blocks registration while paused", async function () {
      await ledger.pause();

      await expect(
        registerSample(),
      ).to.be.revertedWithCustomError(
        ledger,
        "EnforcedPause",
      );
    });

    it("blocks movements while paused", async function () {
      await registerSample();

      await ledger.pause();

      await expect(
        move("PALLET001", "Storage A", Status.Stored),
      ).to.be.revertedWithCustomError(
        ledger,
        "EnforcedPause",
      );
    });

    it("allows reading history during an emergency pause", async function () {
      await registerSample();

      await ledger.pause();

      const history = await ledger.getHistory("PALLET001");

      expect(history.length).to.equal(1);
    });

    it("allows the admin to resume operations", async function () {
      await ledger.pause();
      await ledger.unpause();

      expect(await ledger.paused()).to.equal(false);

      await registerSample();

      expect(await ledger.getItemCount()).to.equal(1n);
    });

    it("prevents unauthorized users from pausing", async function () {
      await expect(
        ledger.connect(outsider).pause(),
      ).to.be.revertedWithCustomError(
        ledger,
        "AccessControlUnauthorizedAccount",
      );
    });
  });
});
