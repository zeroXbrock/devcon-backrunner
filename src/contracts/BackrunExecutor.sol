// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);

    function transfer(address to, uint256 amount) external returns (bool);
}

interface ISushiPair {
    function swap(
        uint256 amount0Out,
        uint256 amount1Out,
        address to,
        bytes calldata data
    ) external;
}

interface IUniPool {
    function swap(
        address recipient,
        bool zeroForOne,
        int256 amountSpecified,
        uint160 sqrtPriceLimitX96,
        bytes calldata data
    ) external returns (int256 amount0, int256 amount1);
}

contract BackrunExecutor {
    address private owner;
    IERC20 private WETH;

    constructor() {
        owner = msg.sender;
        WETH = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    }

    /** params:
    sushiPair: address of asset pair pool on sushi
    uniPool: address of asset pair pool on uni
    token: address of token we're buying & selling (the one that's not WETH)
    sushiTokenZeroForOne: true == token0 -> token1; false == token1 -> token0
    uniTokenZeroForOne: true == token0 -> token1; false == token1 -> token0
    buyAmount: amount of tokens to buy on Uniswap
     */
    function execute(
        address _sushiPair,
        address _uniPool,
        address _token,
        bool sushiZeroForOne,
        bool uniZeroForOne,
        int256 buyAmount,
        uint160 uniSqrtPriceLimitX96
    ) public returns (uint256) {
        require(msg.sender == owner, "unauthorized");
        IERC20 token = IERC20(_token);
        ISushiPair sushiPair = ISushiPair(_sushiPair);
        IUniPool uniPool = IUniPool(_uniPool);
        // buy discounted tokens on UNI
        uniPool.swap(
            address(this),
            uniZeroForOne,
            buyAmount,
            uniSqrtPriceLimitX96,
            ""
        );
        // sell tokens on SUSHI
        sushiPair.swap(
            // sushiAmount0Out,
            sushiZeroForOne ? token.balanceOf(address(this)) : 0,
            sushiZeroForOne ? 0 : token.balanceOf(address(this)),
            address(this),
            ""
        );
        return WETH.balanceOf(address(this));
    }

    function liquidate() public {
        WETH.transfer(owner, WETH.balanceOf(address(this)));
    }
}
