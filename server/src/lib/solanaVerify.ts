import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

const RPC = process.env.SOLANA_RPC ?? "https://api.mainnet-beta.solana.com";
const PAYMENT_WALLET = process.env.PAYMENT_WALLET_ADDRESS ?? "";

export interface TxVerifyResult {
  valid: boolean;
  error?: string;
  amountSol?: number;
  amountUsdc?: number;
  currency?: "SOL" | "USDC";
  sender?: string;
  blockTime?: number;
}

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export async function verifyTransaction(txSignature: string): Promise<TxVerifyResult> {
  if (!PAYMENT_WALLET) {
    return { valid: false, error: "PAYMENT_WALLET_ADDRESS env var not set" };
  }

  try {
    const conn = new Connection(RPC, "confirmed");
    const tx = await conn.getParsedTransaction(txSignature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });

    if (!tx) return { valid: false, error: "Transaction not found" };
    if (tx.meta?.err) return { valid: false, error: "Transaction failed on-chain" };

    const recipientKey = PAYMENT_WALLET;

    // Check native SOL transfers
    const accountKeys = tx.transaction.message.accountKeys.map(k =>
      typeof k === "string" ? k : k.pubkey.toString()
    );
    const recipientIdx = accountKeys.indexOf(recipientKey);

    if (recipientIdx !== -1 && tx.meta) {
      const pre = tx.meta.preBalances[recipientIdx] ?? 0;
      const post = tx.meta.postBalances[recipientIdx] ?? 0;
      const diff = post - pre;
      if (diff > 0) {
        return {
          valid: true,
          amountSol: diff / LAMPORTS_PER_SOL,
          currency: "SOL",
          sender: accountKeys[0],
          blockTime: tx.blockTime ?? undefined,
        };
      }
    }

    // Check USDC token transfers
    const tokenBalances = tx.meta?.postTokenBalances ?? [];
    const preTokenBalances = tx.meta?.preTokenBalances ?? [];
    for (const post of tokenBalances) {
      if (
        post.mint === USDC_MINT &&
        post.owner === recipientKey
      ) {
        const pre = preTokenBalances.find(p => p.accountIndex === post.accountIndex);
        const preAmt = Number(pre?.uiTokenAmount?.uiAmount ?? 0);
        const postAmt = Number(post.uiTokenAmount?.uiAmount ?? 0);
        const diff = postAmt - preAmt;
        if (diff > 0) {
          return {
            valid: true,
            amountUsdc: diff,
            currency: "USDC",
            sender: accountKeys[0],
            blockTime: tx.blockTime ?? undefined,
          };
        }
      }
    }

    return { valid: false, error: "No payment to your wallet found in this transaction" };
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : String(e) };
  }
}
