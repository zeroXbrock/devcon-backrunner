import { FlashbotsBundleProvider } from '@flashbots/ethers-provider-bundle'
import { Contract, Wallet, providers, utils, UnsignedTransaction } from "ethers"
import contracts from './lib/contracts'
import { padRightWithZeros } from './lib/helpers'
import tokens from './lib/tokens'
import { ExactInputSingle } from './lib/uniswap'

const processBundle = async (bundle: string[], provider: providers.BaseProvider, flashbotsProvider: FlashbotsBundleProvider) => {
    const blockNum = await provider.getBlockNumber()
    const simResult = flashbotsProvider.simulate(bundle, blockNum)
    console.log("simResult", simResult)
}

async function main() {
    const provider = new providers.WebSocketProvider("ws://192.168.0.42:7777")
    const authSigner = new Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80")
    const flashbotsProvider = await FlashbotsBundleProvider.create(provider, authSigner, "http://192.168.0.42:7777")
    const uniFactory = new Contract(contracts.UniV3Factory.address, contracts.UniV3Factory.abi, provider)
    const sushiFactory = new Contract(contracts.SushiV2Factory.address, contracts.SushiV2Factory.abi, provider)
    const backrunExecutor = new Contract(contracts.Backrun.address, contracts.Backrun.abi)
    const sender = new Wallet(process.env.ETH_PRV_KEY || "")

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
                    // console.log("exactInputSingle")
                    const multicallDecoded = utils.defaultAbiCoder.decode([
                        "struct(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)"],
                        `0x${padRightWithZeros(multicallBody.substring(10), 256)}`)
                    // console.log("exactInputSingle multicallDecoded", multicallDecoded)

                    const tokenIn = multicallDecoded[0]
                    const tokenOut = multicallDecoded[1]
                    const fee = multicallDecoded[2]
                    const recipient = multicallDecoded[3]
                    const amountIn = multicallDecoded[4]
                    const amountOutMinimum = multicallDecoded[5]
                    const sqrtPriceLimitX96 = multicallDecoded[6]

                    if (!tokenIn || !tokenOut) {
                        return
                    }

                    const trade: ExactInputSingle = {
                        tokenIn,
                        tokenOut,
                        fee,
                        recipient,
                        amountIn,
                        amountOutMinimum,
                        sqrtPriceLimitX96,
                    }

                    if ((tokenOut as string).toLowerCase() === (tokens.WETH as string).toLowerCase()) {
                        const uniPool = await uniFactory.getPool(tokenIn, tokenOut, fee)
                        const sushiPool = await sushiFactory.getPool(tokenIn, tokenOut)
                        console.log("uniPool address", uniPool)
                        console.log("sushiPool address", sushiPool)

                        console.log()

                        const backrunTx = await backrunExecutor.populateTransaction.execute(
                            uniPool,
                            sushiPool,
                            true,
                            amountIn,
                            sqrtPriceLimitX96
                        )
                        const signedBackrunTx = await sender.signTransaction(backrunTx)

                        const {r, s, v} = tx
                        const unsignedMempoolTx: UnsignedTransaction = tx
                        delete tx.gasPrice
                        const signedMempoolTx = utils.serializeTransaction(unsignedMempoolTx, {r: r || "", s, v})

                        const bundleTxs = [
                            signedMempoolTx,
                            signedBackrunTx,
                        ]

                        processBundle(bundleTxs, provider, flashbotsProvider)
                    }
                    console.log("hash", tx.hash)
                } 
                // else if (multicallSig === "5023b4df") { // exactOutputSingle
                //     const multicallDecoded = utils.defaultAbiCoder.decode([
                //         "struct(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountOut, uint256 amountInMaximum, uint160 sqrtPriceLimitX96)"],
                //         `0x${padRightWithZeros(multicallBody.substring(10), 256)}`)
                //     console.log("exactOutputSingle multicallDecoded", multicallDecoded)


                // }
            }
            
        }
    })
}

main()
