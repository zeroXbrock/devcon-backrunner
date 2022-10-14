import dotenv from "dotenv"
import { Wallet, providers, Contract } from "ethers"
import { FlashbotsBundleProvider } from "@flashbots/ethers-provider-bundle"
import contracts from "./lib/contracts"
import { ExactInputSingle, ExactOutputSingle, UniswapTrade, decodeTx as decodeUniswapTx } from './lib/uniswap'
import tokens from "./lib/tokens"
import { now } from './lib/helpers'

export const DEBUG = false

// init .env
dotenv.config()

const isJuicy = (tx: providers.TransactionResponse, decodedTx: UniswapTrade) => {
    // looking for transactions that trade TOKEN_X for WETH
    // we have weth
    // we want to buy the tokens that they're selling
    return (
        tx.confirmations === 0 &&
        decodedTx.tokenOut === tokens.WETH.address &&
        decodedTx.deadline > now() + 24  // deadline max: 24 seconds in future
    )
}

const main = async () => {
    const provider = new providers.WebSocketProvider(process.env.RPC_URL_WS || "", {chainId: parseInt(process.env.CHAIN_ID || "5"), name: process.env.CHAIN_NAME || "goerli"})
    const authSigner = new Wallet(process.env.AUTH_PRV_KEY || "")
    const flashbots = await FlashbotsBundleProvider.create(provider, authSigner, process.env.CHAIN_NAME)
    let backruns = []

    const uniswapFactory = new Contract(contracts.UniswapV3Factory.address, contracts.UniswapV3Factory.abi, provider)
    const sushiswapFactory = new Contract(contracts.SushiswapFactory.address, contracts.SushiswapFactory.abi, provider)

    console.log("monitoring mempool...")
    let foundAnyCount = 0
    provider.on("pending", async (pendingTxHash) => {
        foundAnyCount += 1
        // look for transactions to SwapRouter
        const tx = await provider.getTransaction(pendingTxHash)
        if (tx?.to && tx.to === contracts.UniSwapRouter02.address) {
            DEBUG && console.log("✅ Found Uniswap trade. data:", tx)
            // decode calldata
            const decodedTx = decodeUniswapTx(tx.data)
            if (decodedTx && isJuicy(tx, decodedTx)) {
                // user is trading X tokens for WETH
                // buy X tokens
                const buyAmount = decodedTx instanceof ExactInputSingle ?
                decodedTx.amountIn :
                decodedTx.amountInMaximum

                // get pool addresses for each exchange
                const sushiPoolPromise = sushiswapFactory.getPair(decodedTx.tokenIn, decodedTx.tokenOut)
                const uniPoolPromise = uniswapFactory.getPool(decodedTx.tokenIn, decodedTx.tokenOut, decodedTx.fee)

                const sushiPoolAddress = await sushiPoolPromise
                if (sushiPoolAddress === "0x0000000000000000000000000000000000000000") {
                    console.error("SUSHI pool does not exist for this token pair")
                    return
                }
                const uniPoolAddress = await uniPoolPromise

                const backrun = {
                    sushiPoolAddress,
                    uniPoolAddress,
                    backrunTx: tx,
                    buyAmount,
                    decodedTx,
                }
                console.log("BACKRUN", backrun)
                backruns.push(tx)
            } else {
                DEBUG && console.warn("not juicy")
            }
        }
        process.stdout.write(`\rFound ${foundAnyCount} transactions -- ${backruns.length} backrunnable`)
    })
}

main()
