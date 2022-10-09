# backrunner

on mainnet.

- [ ] watch transactions from uniswap trades in the mempool
- [ ] craft a backrun arb
- [ ] write arb executor contract
- [ ] execute arb using Flashbots

Running a mempool backrunner can be risky. There are poison tokens that drain your liquidity when you trade them. See [salmonella](http://TODO-add-link.pls) for an example.

For that reason, we will choose a strict list of tokens that we know are safe. There are plenty of ways to discover more safe tokens, but for demonstration's sake we'll stick with the discrete list in [tokens.json](./src/lib/tokens.json).
