import { providers, utils } from "ethers"
import contracts from './lib/contracts'

async function main() {
    const provider = new providers.WebSocketProvider("ws://192.168.0.42:7777")

    provider.on("pending", async (pendingTxHash) => {
        // console.log(pendingTxHash)
        const tx = await provider.getTransaction(pendingTxHash)
        if (tx && tx.to && tx.to === contracts.UniSwapRouter02.address) {
            if (tx.data.substring(2, 10) === "1f0464d1") {
                // multicall detected
                console.log("multicall!!!")
                const multicallData = utils.defaultAbiCoder.decode([
                    "uint256 deadline",
                    "bytes[] data"
                ], tx.data.substring(10))
                console.log("multicall data", multicallData)
            }
            
        }
    })
}

main()
