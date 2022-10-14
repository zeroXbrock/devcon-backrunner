import { providers, utils } from "ethers"
import contracts from './lib/contracts'
import { padRightWithZeros } from './lib/helpers'

async function main() {
    const provider = new providers.WebSocketProvider("ws://192.168.0.42:7777")

    provider.on("pending", async (pendingTxHash) => {
        // console.log(pendingTxHash)
        const tx = await provider.getTransaction(pendingTxHash)
        if (tx && tx.to && tx.to === contracts.UniSwapRouter02.address) {
            if (tx.data.substring(2, 10) === "5ae401dc") {
                // multicall detected
                const callData = utils.defaultAbiCoder.decode([
                    "uint256 deadline",
                    "bytes[] data"
                ], `0x${tx.data.substring(10)}`)
                const deadline = callData[0]
                const multicallData = callData[1]
                const multicallBody: string = multicallData[0]
                
                const multicallSig = multicallBody.substring(2, 10)
                if (multicallSig === "04e45aaf") { // exactInputSingle
                    console.log("exactInputSingle")
                    const multicallDecoded = utils.defaultAbiCoder.decode([
                        "struct(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)"],
                        `0x${padRightWithZeros(multicallBody.substring(10), 256)}`)
                    console.log("exactInputSingle multicallDecoded", multicallDecoded)

                    const tokenIn = multicallDecoded[0]
                    const tokenOut = multicallDecoded[1]
                    console.log("hash", tx.hash)
                } else if (multicallSig === "5023b4df") { // exactOutputSingle
                    const multicallDecoded = utils.defaultAbiCoder.decode([
                        "struct(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountOut, uint256 amountInMaximum, uint160 sqrtPriceLimitX96)"],
                        `0x${padRightWithZeros(multicallBody.substring(10), 256)}`)
                    console.log("exactOutputSingle multicallDecoded", multicallDecoded)
                }
            }
            
        }
    })
}

main()
