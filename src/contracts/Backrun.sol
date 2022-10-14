// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);

    function transfer(address to, uint256 amount) external returns (bool);
}

interface IUniswapV3Pool {
    function swap(
        address recipient,
        bool zeroForOne,
        int256 amountSpecified,
        uint160 sqrtPriceLimitX96,
        bytes calldata data
    ) external returns (int256 amount0, int256 amount1);
}

interface ISushiPair {
    function swap(
        uint256 amount0Out,
        uint256 amount1Out,
        address to,
        bytes calldata data
    ) external;
}

contract Backrun {
    address private owner;
    IERC20 WETH;

    constructor() {
        owner = msg.sender;
        WETH = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    }

    //
    function execute(
        address _uniPool,
        address _sushiPool,
        bool uniZeroForOne,
        int256 buyAmount,
        uint160 sqrtPriceLimitX96
    ) public returns (uint256) {
        require(msg.sender == owner);
        IUniswapV3Pool uniPool = IUniswapV3Pool(_uniPool);
        ISushiPair sushiPool = ISushiPair(_sushiPool);

        // buy the tokens on uniswap
        (int256 _amount0, int256 amount1) = uniPool.swap(
            address(this),
            uniZeroForOne,
            buyAmount,
            sqrtPriceLimitX96,
            ""
        );

        // sell tokens on sushiswap
        sushiPool.swap(0, uint256(amount1), address(this), "");

        return WETH.balanceOf(address(this));
    }

    function liquidate() public {
        // transfer funds to owner
        WETH.transfer(owner, WETH.balanceOf(address(this)));
    }
}
