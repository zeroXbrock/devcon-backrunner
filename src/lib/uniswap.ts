import { BigNumber, utils } from "ethers"
import { padRightWithZeros } from './helpers'

const DEBUG = false
export type UniswapTrade = ExactInputSingle | ExactOutputSingle

export const decodeTx = (data: string): UniswapTrade | undefined => {
    const selector = data.substring(2, 10)
    if (selector === "5ae401dc") {
        // multicall detected
        const multicallData = data.substring(10)
        const decodedMulticall = utils.defaultAbiCoder.decode(["uint256", "bytes[]"], `0x${multicallData}`)
        
        // break down multicall params
        const deadline = decodedMulticall[0]
        const multicallBytes = decodedMulticall[1]
        
        // decode trade action from multicall bytes
        const tradeCalldata: string = multicallBytes[0]
        const swapSignature = tradeCalldata.substring(2, 10)

        if (swapSignature === "472b43f3") { // swapExactTokensForTokens
            DEBUG && console.warn("swapExactTokensForTokens unimplemented")
            return undefined
        } else if (swapSignature === "42712a67") { // swapTokensForExactTokens
            DEBUG && console.warn("swapTokensForExactTokens unimplemented")
            return undefined
        } else if (swapSignature === "04e45aaf") { // exactInputSingle
            return new ExactInputSingle(tradeCalldata, deadline)
        } else if (swapSignature === "5023b4df") { // exactOutputSingle
            return new ExactOutputSingle(tradeCalldata, deadline)
        }
        return undefined
    } else {
        return undefined
    }
}

export class ExactInputSingle {
    public tokenIn: string
    public tokenOut: string
    public fee: number
    public recipient: string
    public deadline: number
    public amountIn: BigNumber
    public amountOutMinimum: BigNumber
    public sqrtPriceLimitX96: BigNumber

    // exactInputSingle is always showing `0` for amountInMaximum

    constructor(tradeCalldata: string, deadline: number) {
        const decodedSwap = this.decode(tradeCalldata.substring(10))[0]
        this.tokenIn = decodedSwap[0]
        this.tokenOut = decodedSwap[1]
        this.fee = decodedSwap[2]
        this.recipient = decodedSwap[3]
        // this.deadline = decodedSwap[4]
        this.deadline = deadline
        this.amountIn = decodedSwap[4]
        this.amountOutMinimum = decodedSwap[5]
        this.sqrtPriceLimitX96 = decodedSwap[6]
    }

    decode(data: string) {
        /**
            address tokenIn;
            address tokenOut;
            uint24 fee;
            address recipient;
            uint256 deadline; // DNE
            uint256 amountIn;
            uint256 amountOutMinimum;
            uint160 sqrtPriceLimitX96;
         */
        const structDef = "tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint256 sqrtPriceLimitX96)"
        return utils.defaultAbiCoder.decode([structDef], `0x${padRightWithZeros(data, 256)}`)
    }
}

export class ExactOutputSingle {
    public tokenIn: string
    public tokenOut: string
    public fee: number
    public recipient: string
    public deadline: number
    public amountOut: BigNumber
    public amountInMaximum: BigNumber
    public sqrtPriceLimitX96: BigNumber

    constructor(tradeCalldata: string, deadline: number) {
        const decodedSwap = this.decode(tradeCalldata.substring(10))[0]
        this.tokenIn = decodedSwap[0]
        this.tokenOut = decodedSwap[1]
        this.fee = decodedSwap[2]
        this.recipient = decodedSwap[3]
        // this.deadline = decodedSwap[4] // DNE -- is 
        this.deadline = deadline
        this.amountOut = decodedSwap[4]
        this.amountInMaximum = decodedSwap[5]
        this.sqrtPriceLimitX96 = decodedSwap[6]
    }

    decode(data: string) {
        /**
            address tokenIn;
            address tokenOut;
            uint24 fee;
            address recipient;
            uint256 deadline;
            uint256 amountOut;
            uint256 amountInMaximum;
            uint160 sqrtPriceLimitX96;
         */
        const structDef = "tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountOut, uint256 amountInMaximum, uint256 sqrtPriceLimitX96)"
        return utils.defaultAbiCoder.decode([structDef], `0x${padRightWithZeros(data, 256)}`)
    }
}
