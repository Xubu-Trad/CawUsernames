// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {PathwayExpander, ILzEndpoint} from "../contracts/PathwayExpander.sol";

// Synthetic endpoint: exercises expander control flow, not LayerZero internals.
contract PinEndpointDouble {
    address public sendLib;
    address public receiveLib;
    uint256 public writes;
    function setConfig(address, address, ILzEndpoint.SetConfigParam[] calldata) external {}
    function getSendLibrary(address, uint32) external view returns(address) { return sendLib; }
    function isDefaultSendLibrary(address, uint32) external view returns(bool) { return sendLib == address(0); }
    function getReceiveLibrary(address, uint32) external view returns(address,bool) { return (receiveLib, receiveLib == address(0)); }
    function setSendLibrary(address, uint32, address lib) external { sendLib=lib; writes++; }
    function setReceiveLibrary(address, uint32, address lib, uint256 grace) external { require(grace==0); receiveLib=lib; writes++; }
}
contract NonOwnerCaller {
    function attempt(address target, bytes calldata data) external returns(bool) {
        (bool success,) = target.call(data); return success;
    }
}
contract PinSealHarness {
    uint256 public checks;
    address public expander;
    function check(bool condition) internal { require(condition,"harness assertion"); checks++; }
    function rejected(address target, bytes memory data) internal { (bool success,)=target.call(data); check(!success); }
    constructor() {
        PathwayExpander p=new PathwayExpander(address(this));
        PinEndpointDouble ep=new PinEndpointDouble();
        NonOwnerCaller outsider=new NonOwnerCaller();
        expander=address(p);
        address app=address(0x1234); address lib=address(0x5678); address other=address(0x9876);
        bytes memory send=abi.encodeCall(p.pinSendLibrary,(app,address(ep),uint32(1),lib));
        bytes memory recv=abi.encodeCall(p.pinReceiveLibrary,(app,address(ep),uint32(1),lib));
        check(p.owner()==address(this));
        rejected(address(p),send); rejected(address(p),recv);
        p.configureNewPathway(app,address(ep),lib,1,hex"01");
        check(!outsider.attempt(address(p),send));
        check(!outsider.attempt(address(p),recv));
        p.pinSendLibrary(app,address(ep),1,lib);
        p.pinReceiveLibrary(app,address(ep),1,lib);
        check(ep.sendLib()==lib && ep.receiveLib()==lib && ep.writes()==2);
        p.pinSendLibrary(app,address(ep),1,lib);
        p.pinReceiveLibrary(app,address(ep),1,lib);
        check(ep.writes()==2);
        p.configureNewPathway(app,address(ep),other,1,hex"01");
        rejected(address(p),abi.encodeCall(p.pinSendLibrary,(app,address(ep),uint32(1),other)));
        rejected(address(p),abi.encodeCall(p.pinReceiveLibrary,(app,address(ep),uint32(1),other)));
        rejected(address(p),abi.encodeCall(p.transferOwnership,(address(outsider))));
        p.finalizeBootstrap();
        check(p.owner()==address(0));
        rejected(address(p),send); rejected(address(p),recv);
        rejected(address(p),abi.encodeCall(p.configureNewPathway,(app,address(ep),lib,uint32(2),hex"01")));
        rejected(address(p),abi.encodeCall(p.finalizeBootstrap,()));
        check(ep.sendLib()==lib && ep.receiveLib()==lib && ep.writes()==2);
    }
}
