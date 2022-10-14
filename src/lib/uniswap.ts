import { BigNumber } from 'ethers'

export interface ExactInputSingle {
    tokenIn: string,
    tokenOut: string,
    fee: number,
    recipient: string,
    // deadline: BigNumber,
    amountIn: BigNumber,
    amountOutMinimum: BigNumber,
    sqrtPriceLimitX96: BigNumber,
}

export interface ExactOutputSingle {
    tokenIn: string,
    tokenOut: string,
    fee: number,
    recipient: string,
    // deadline: BigNumber,
    amountOut: BigNumber,
    amountInMaximum: BigNumber,
    sqrtPriceLimitX96: BigNumber,
}
