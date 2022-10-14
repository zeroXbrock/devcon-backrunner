import dotenv from "dotenv"
import { Wallet, providers, Contract, UnsignedTransaction, BigNumber, utils } from "ethers"
import { FlashbotsBundleProvider } from "@flashbots/ethers-provider-bundle"
import contracts from "./lib/contracts"
import { ExactInputSingle, ExactOutputSingle, UniswapTrade, decodeTx as decodeUniswapTx } from './lib/uniswap'
import tokens from "./lib/tokens"
import { getPoolAddresses, now } from './lib/helpers'

export const DEBUG = false
type Backrun = {
    sushiPoolAddress: string,
    uniPoolAddress: string,
    mempoolTx: providers.TransactionResponse,
    buyAmount: BigNumber,
    decodedTx: UniswapTrade,
}

type ContractInstances = {
    backrunExecutor: Contract,
    uniswapFactory: Contract,
    sushiswapFactory: Contract,
}

// init .env
dotenv.config()

async function main() {
    const provider = new providers.WebSocketProvider(process.env.RPC_URL_WS || "", {chainId: parseInt(process.env.CHAIN_ID || "5"), name: process.env.CHAIN_NAME || "goerli"})
    const authSigner = new Wallet(process.env.AUTH_PRV_KEY || "")
    const flashbots = await FlashbotsBundleProvider.create(provider, authSigner, process.env.CHAIN_NAME)
    const uniswapFactory = new Contract(contracts.UniswapV3Factory.address, contracts.UniswapV3Factory.abi, provider)
    const sushiswapFactory = new Contract(contracts.SushiswapFactory.address, contracts.SushiswapFactory.abi, provider)
    const backrunExecutor = new Contract(contracts.BackrunExecutor.address, contracts.BackrunExecutor.abi)

    monitorMempool(provider, flashbots, {sushiswapFactory, uniswapFactory, backrunExecutor})
}

const monitorMempool = async (provider: providers.WebSocketProvider, flashbotsProvider: FlashbotsBundleProvider, contractInstances: ContractInstances) => {
    if (!process.env.SENDER_PRV_KEY) {
        console.error("missing SENDER_PRV_KEY in .env")
        return
    }
    const sender = new Wallet(process.env.SENDER_PRV_KEY)
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

    console.log("monitoring mempool...")
    let foundAnyCount = 0
    let foundBackrunCount = 0

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
                const {uniPoolAddress, sushiPoolAddress} = await getPoolAddresses(decodedTx, contractInstances.sushiswapFactory, contractInstances.uniswapFactory)
                if (sushiPoolAddress === "0x0000000000000000000000000000000000000000") {
                    console.error("SUSHI pool does not exist for this token pair")
                    return
                }

                const backrun = {
                    sushiPoolAddress,
                    uniPoolAddress,
                    mempoolTx: tx,
                    buyAmount,
                    decodedTx,
                }
                foundBackrunCount += 1
                processBackrun(provider, flashbotsProvider, sender, backrun, contractInstances)
            } else {
                DEBUG && console.warn("not juicy")
            }
        }
        process.stdout.write(`\rFound ${foundAnyCount} transactions -- ${foundBackrunCount} backrunnable`)
    })
}

const processBackrun = async (provider: providers.WebSocketProvider, flashbotsProvider: FlashbotsBundleProvider, sender: Wallet, backrun: Backrun, contractInstances: ContractInstances) => {
    const blockNum = provider.getBlockNumber()

    const mempoolTx: UnsignedTransaction = backrun.mempoolTx
    delete mempoolTx.gasPrice
    const {r, s, v} = backrun.mempoolTx
    const signedMempoolTx = utils.serializeTransaction(mempoolTx, {r: r || "", s, v})

    const { uniPoolAddress, sushiPoolAddress } = await getPoolAddresses(backrun.decodedTx, contractInstances.sushiswapFactory, contractInstances.uniswapFactory)
    const uniPool = new Contract(uniPoolAddress, contracts.IUniswapV3Pool.abi, provider)
    const sushiPool = new Contract(sushiPoolAddress, contracts.ISushiswapV3Pair.abi, provider)
    const tokenAddress = backrun.decodedTx.tokenIn // will always be tokenIn bc we filter by (tokenOut == WETH)
    const sushiPoolToken0 = sushiPool.token0
    const uniPoolToken0 = uniPool.token0
    const buyAmount = backrun.decodedTx instanceof ExactOutputSingle ? backrun.decodedTx.amountInMaximum : backrun.decodedTx.amountIn
    const backrunTx = {
        ...await contractInstances.backrunExecutor.populateTransaction.execute(
            sushiPoolAddress,
            uniPoolAddress,
            tokenAddress,
            (await sushiPoolToken0) === tokenAddress,
            (await uniPoolToken0) === tokens.WETH.address,
            buyAmount,
            backrun.decodedTx.sqrtPriceLimitX96
        ),
        type: 2,
        maxFeePerGas: BigNumber.from(1e9).mul(42),
        maxPriorityFeePerGas: BigNumber.from(1e9).mul(3),
        gasLimit: BigNumber.from(800000),
        chainId: 1,
        nonce: (await sender.getTransactionCount()),
        value: BigNumber.from(0),
    }

    const signedBackrunTx = await sender.signTransaction(backrunTx)

    const bundleTxs = [
        signedMempoolTx,
        signedBackrunTx
    ]
    
    flashbotsProvider.simulate(bundleTxs, (await blockNum) + 1)

    console.log("SENDING BACKRUN TO FLASHBOTS", backrun)
    console.log("TODO")
}

main()
console.log("NEAT")
