// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/PathwayExpander.sol";

contract AuthorityExpiryMockOApp {
  address public owner;
  mapping(uint32 => bytes32) public peers;

  constructor(address _owner) {
    owner = _owner;
  }

  function setPeer(uint32 eid, bytes32 peer) external {
    require(msg.sender == owner, "not owner");
    peers[eid] = peer;
  }

  function transferOwnership(address newOwner) external {
    require(msg.sender == owner, "not owner");
    owner = newOwner;
  }

  function renounceOwnership() external {
    require(msg.sender == owner, "not owner");
    owner = address(0);
  }
}

contract PathwayExpanderAuthorityExpiry is Test {
  PathwayExpander pe;
  AuthorityExpiryMockOApp oapp;

  address outsider = address(0xB0B);

  function setUp() public {
    pe = new PathwayExpander(address(this));
    oapp = new AuthorityExpiryMockOApp(address(pe));
  }

  function test_expiryIsExactlyFixedWindow() public {
    uint64 deployedAt = uint64(block.timestamp);
    PathwayExpander fresh = new PathwayExpander(address(this));

    assertEq(
      fresh.authorityExpiry(),
      deployedAt + fresh.AUTHORITY_WINDOW()
    );
    assertTrue(fresh.authorityActive());

    vm.expectRevert("PathwayExpander: authority active");
    fresh.finalizeExpiredAuthority();
  }

  function test_allPrivilegedSurfacesClosedAtExactExpiry() public {
    vm.warp(pe.authorityExpiry());

    vm.expectRevert("PathwayExpander: authority expired");
    pe.addPeer(address(0), 1, bytes32(0));

    address[] memory oapps = new address[](0);
    uint32[] memory eids = new uint32[](0);
    bytes32[] memory peers = new bytes32[](0);

    vm.expectRevert("PathwayExpander: authority expired");
    pe.addPeers(oapps, eids, peers);

    vm.expectRevert("PathwayExpander: authority expired");
    pe.addKycVerifier(address(0), 2, address(0));

    vm.expectRevert("PathwayExpander: authority expired");
    pe.configureNewPathway(
      address(0), address(0), address(0), 1, hex""
    );

    vm.expectRevert("PathwayExpander: authority expired");
    pe.addDvnToPathway(
      address(0), address(0), address(0), 1, hex"", hex""
    );
  }

  function test_transferCannotExtendDeadline() public {
    uint64 expiry = pe.authorityExpiry();
    address nextOwner = address(0xBEEF);

    pe.transferOwnership(nextOwner);

    assertEq(pe.owner(), nextOwner);
    assertEq(pe.authorityExpiry(), expiry);

    vm.warp(expiry);

    vm.prank(nextOwner);
    vm.expectRevert("PathwayExpander: authority expired");
    pe.transferOwnership(address(0xCAFE));
  }

  function test_permissionlessFinalizationPreservesPeerState() public {
    uint32 eid = 30184;
    bytes32 peer = bytes32(uint256(uint160(address(0x1234))));

    pe.addPeer(address(oapp), eid, peer);

    assertEq(oapp.peers(eid), peer);

    vm.warp(pe.authorityExpiry());

    vm.prank(outsider);
    pe.finalizeExpiredAuthority();

    assertEq(pe.owner(), address(0));
    assertFalse(pe.authorityActive());
    assertEq(oapp.owner(), address(pe));
    assertEq(oapp.peers(eid), peer);
  }

  function test_earlyRenounceClosesAuthority() public {
    pe.renounceOwnership();

    assertEq(pe.owner(), address(0));
    assertFalse(pe.authorityActive());

    vm.expectRevert("Ownable: caller is not the owner");
    pe.addPeer(address(oapp), 30184, bytes32(uint256(1)));
  }
}
