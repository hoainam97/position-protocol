// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../protocol/ChainLinkPriceFeed.sol";

contract ChainLinkPriceFeedMock is ChainLinkPriceFeed {
    mapping (bytes32 => uint256) public mockPriceFeedMap;

    function mockIndexPrice(bytes32 _priceFeedKey, uint256 _indexPrice) public {
        mockPriceFeedMap[_priceFeedKey] = _indexPrice;
    }

    function getTwapPrice(bytes32 _priceFeedKey, uint256 _internal) external view override returns (uint256) {
        return mockPriceFeedMap[_priceFeedKey];
    }

    function getPrice(bytes32 _priceFeedKey) external view override returns (uint256) {
        return mockPriceFeedMap[_priceFeedKey];
    }
}