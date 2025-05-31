require("dotenv").config();
const { ethers } = require("ethers");

const RPC_URL        = process.env.RPC_URL;
const PRIVATE_KEY    = process.env.PRIVATE_KEY;
const CONTRACT_ADDR  = process.env.CONTRACT_ADDRESS;

// How often to print a log line (e.g. every 1000 TXs)
const LOG_INTERVAL = 1000;

(async () => {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet   = new ethers.Wallet(PRIVATE_KEY, provider);

  // Fetch the starting nonce once
  let currentNonce = await provider.getTransactionCount(wallet.address, "latest");
  console.log("Starting claim loop at nonce", currentNonce);
  console.log("Wallet:", wallet.address);

  let counter = 0;

  while (true) {
    try {
      // Build the transaction object (no await here)
      const txRequest = {
        to:       CONTRACT_ADDR,
        data:     "0x05632f40",    // function selector for claim()
        gasLimit: 100_000,          // adjust if needed
        nonce:    currentNonce
      };

      // 1) Locally sign the transaction (very fast)
      const signedTxPromise = wallet.signTransaction(txRequest);

      // 2) Immediately increment local nonce
      currentNonce++;

      // 3) When signing is done, send raw
      signedTxPromise
        .then((signedTx) => {
          // fire-and-forget: we do NOT await this
          provider.sendRawTransaction(signedTx).catch((err) => {
            // If the node rejects it, log it once
            console.error(
              `[sendRaw] ❌ TX at nonce ${txRequest.nonce} rejected:`,
              err.reason || err.message || err
            );
          });
        })
        .catch((signErr) => {
          console.error(
            `[signing] ❌ Failed to sign TX at nonce ${txRequest.nonce}:`,
            signErr.message || signErr
          );
        });

      counter++;
      if (counter % LOG_INTERVAL === 0) {
        console.log(`[${counter.toLocaleString()}] Dispatched TX at nonce ${txRequest.nonce}`);
      }

      // No manual delay; loop continues as fast as CPU can sign
      // If your machine is too fast, you may start lining up thousands of
      // pending TXs in the mempool. Monitor your node’s health!

    } catch (err) {
      // This catch will only fire if something in the synchronous part throws.
      console.error(`[loop] Unexpected error at iteration ${counter}:`, err);
      // Do NOT increment nonce here because nothing was sent/signed.
    }
  }
})();
