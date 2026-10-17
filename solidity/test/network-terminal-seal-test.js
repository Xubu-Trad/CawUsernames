const CawNetworkManager = artifacts.require("CawNetworkManager");
const truffleAssert = require("truffle-assertions");

contract("CawNetworkManager - terminal seal", (accounts) => {
  let networkManager;
  const owner = accounts[0];
  const feeAddress = accounts[1];
  const sponsor = accounts[2];
  const instanceOperator = accounts[3];
  const validator = accounts[4];
  const buyAndBurn = accounts[5];
  const storageEid = 40245;
  const selector = "0x12345678";

  beforeEach(async () => {
    networkManager = await CawNetworkManager.new(buyAndBurn, { from: owner });
    await networkManager.createNetwork(
      "Sealable",
      feeAddress,
      storageEid,
      100,
      200,
      300,
      400,
      500,
      { from: owner },
    );
    await networkManager.addAuthorizedSponsor(1, sponsor, { from: owner });
    await networkManager.setGasOverride(1, selector, 1, { from: owner });
  });

  it("permanently removes the network-owner control plane", async () => {
    assert.equal(await networkManager.isAuthorizedSponsor(1, sponsor), true);

    await networkManager.sealNetwork(1, { from: owner });

    assert.equal(await networkManager.networkSealed(1), true);
    assert.equal(await networkManager.networkFeesLocked(1), true);
    assert.equal(await networkManager.networkOwnershipLocked(1), true);
    assert.equal(
      await networkManager.getNetworkOwner(1),
      "0x0000000000000000000000000000000000000000",
    );
    assert.equal(await networkManager.isAuthorizedSponsor(1, sponsor), false);

    await truffleAssert.reverts(
      networkManager.setGasOverride(1, selector, 2, { from: owner }),
      "Not the owner",
    );
    await truffleAssert.reverts(
      networkManager.addAuthorizedSponsor(1, sponsor, { from: owner }),
      "Not the owner",
    );
    await truffleAssert.reverts(
      networkManager.removeAuthorizedSponsor(1, sponsor, { from: owner }),
      "Not the owner",
    );
    await truffleAssert.reverts(
      networkManager.setFeeAddress(1, accounts[6], { from: owner }),
      "Not the owner",
    );
    await truffleAssert.reverts(
      networkManager.changeOwner(1, accounts[6], { from: owner }),
      "Not the owner",
    );
    await truffleAssert.reverts(
      networkManager.sealNetwork(1, { from: owner }),
      "Not the owner",
    );
  });

  it("keeps permissionless instance registration available after sealing", async () => {
    await networkManager.sealNetwork(1, { from: owner });

    const tx = await networkManager.registerInstance(
      1,
      "https://community.example",
      validator,
      { from: instanceOperator },
    );

    truffleAssert.eventEmitted(tx, "InstanceRegistered", ev =>
      ev.networkId.toString() === "1" &&
      ev.owner.toLowerCase() === instanceOperator.toLowerCase() &&
      ev.validatorAddress.toLowerCase() === validator.toLowerCase()
    );
  });

  it("preserves the configured fee address while removing its controller", async () => {
    await networkManager.sealNetwork(1, { from: owner });
    const network = await networkManager.getNetwork(1);
    assert.equal(network.feeAddress.toLowerCase(), feeAddress.toLowerCase());
  });
});
