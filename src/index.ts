import dotenv from "dotenv"
import { Wallet, providers } from "ethers"
import { FlashbotsBundleProvider } from "@flashbots/ethers-provider-bundle"
import contracts from "./lib/contracts"
// init .env
dotenv.config()

const main = async () => {
    const provider = new providers.WebSocketProvider(process.env.RPC_URL_WS || "", {chainId: parseInt(process.env.CHAIN_ID || "5"), name: process.env.CHAIN_NAME || "goerli"})
    const authSigner = new Wallet(process.env.AUTH_PRV_KEY || "")
    const flashbots = await FlashbotsBundleProvider.create(provider, authSigner, process.env.CHAIN_NAME)

    console.log("monitoring mempool...")
    let foundAnyCount = 0
    let foundBackrunCount = 0
    provider.on("pending", async (pendingTxHash) => {
        foundAnyCount += 1
        // look for transactions to SwapRouter
        // there will not be any legit UI transactions going directly to the router
        // if (pendingTx)
        const tx = await provider.getTransaction(pendingTxHash)
        console.log(`nothing: ${pendingTxHash}`)
        if (tx?.to && tx.to === contracts.SwapRouter02.address) {
            foundBackrunCount += 1
            console.log("✅ Found Uniswap trade. data:", tx)
        }
        console.log(`\rFound ${foundAnyCount} transactions -- ${foundBackrunCount} backrunnable`)
    })
}

main()
