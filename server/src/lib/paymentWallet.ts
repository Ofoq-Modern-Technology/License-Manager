import {
  Connection, Keypair, PublicKey, Transaction,
  SystemProgram, LAMPORTS_PER_SOL, sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress, getAccount,
  createTransferInstruction, getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";

const RPC = process.env.SOLANA_RPC ?? "https://api.mainnet-beta.solana.com";
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

// SOL sent to each USDC payment wallet to cover sweep fees + vault ATA creation
const SWEEP_FUND_LAMPORTS = 4_000_000; // 0.004 SOL

// ── Minimal base58 decoder (no external dep needed) ───────────────────────────
const B58_ALPHA = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function decodeBase58(str: string): Uint8Array {
  const bytes = [0];
  for (const char of str) {
    let carry = B58_ALPHA.indexOf(char);
    if (carry < 0) throw new Error(`Invalid base58 character: ${char}`);
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) { bytes.push(carry & 0xff); carry >>= 8; }
  }
  for (let i = 0; i < str.length && str[i] === "1"; i++) bytes.push(0);
  return new Uint8Array(bytes.reverse());
}

/**
 * Restore a Keypair from either:
 *   - base64 string  (used internally for payment wallets)
 *   - base58 string  (standard Phantom / Solana CLI export)
 */
export function restoreKeypair(privateKey: string): Keypair {
  const b64 = Buffer.from(privateKey, "base64");
  if (b64.length === 64) return Keypair.fromSecretKey(b64);

  const b58 = decodeBase58(privateKey);
  if (b58.length === 64) return Keypair.fromSecretKey(b58);

  throw new Error(`Cannot decode private key: expected 64 bytes, got ${b64.length} (base64) or ${b58.length} (base58)`);
}

export function generatePaymentWallet(): { address: string; privateKey: string } {
  const kp = Keypair.generate();
  return {
    address: kp.publicKey.toBase58(),
    privateKey: Buffer.from(kp.secretKey).toString("base64"),
  };
}

export function getConnection(): Connection {
  return new Connection(RPC, "confirmed");
}

/**
 * Fund a USDC payment wallet with a small amount of SOL so it can pay its own
 * sweep transaction fees later. Called at session creation time.
 *
 * feePayerPrivateKey = VAULT_WALLET_PRIVATE_KEY (small ops/hot wallet with SOL)
 */
export async function fundPaymentWallet(
  paymentWalletAddress: string,
  feePayerPrivateKey: string,
): Promise<void> {
  const conn = getConnection();
  const feePayer = restoreKeypair(feePayerPrivateKey);
  const dest = new PublicKey(paymentWalletAddress);

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: feePayer.publicKey,
      toPubkey: dest,
      lamports: SWEEP_FUND_LAMPORTS,
    }),
  );
  await sendAndConfirmTransaction(conn, tx, [feePayer]);
}

export async function checkWalletBalance(
  address: string,
  currency: "SOL" | "USDC",
): Promise<number> {
  const conn = getConnection();
  const pubkey = new PublicKey(address);

  if (currency === "SOL") {
    const balance = await conn.getBalance(pubkey);
    return balance / LAMPORTS_PER_SOL;
  }

  try {
    const ata = await getAssociatedTokenAddress(USDC_MINT, pubkey);
    const account = await getAccount(conn, ata);
    return Number(account.amount) / 1_000_000;
  } catch {
    return 0;
  }
}

// Sweep SOL from a payment wallet to the vault
export async function sweepSOL(
  paymentWalletPrivateKey: string,
  vaultAddress: string,
): Promise<string> {
  const conn = getConnection();
  const paymentKP = restoreKeypair(paymentWalletPrivateKey);
  const vault = new PublicKey(vaultAddress);

  const balance = await conn.getBalance(paymentKP.publicKey);
  const fee = 5_000;
  const amount = balance - fee;
  if (amount <= 0) throw new Error("Insufficient SOL balance to sweep");

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: paymentKP.publicKey,
      toPubkey: vault,
      lamports: amount,
    }),
  );
  return sendAndConfirmTransaction(conn, tx, [paymentKP]);
}

/**
 * Sweep USDC from a payment wallet to the vault address.
 *
 * The payment wallet was pre-funded with SOL at session creation time, so it
 * can pay its own transaction fees here — no vault private key needed.
 *
 * The vault is just a destination address (can be a cold wallet).
 */
export async function sweepUSDC(
  paymentWalletPrivateKey: string,
  vaultAddress: string,
  usdcAmount: bigint,
): Promise<string> {
  const conn = getConnection();
  const paymentKP = restoreKeypair(paymentWalletPrivateKey);
  const vault = new PublicKey(vaultAddress);

  // Payment wallet creates vault's USDC ATA if it doesn't exist (and pays for it)
  const destATA = await getOrCreateAssociatedTokenAccount(
    conn,
    paymentKP,   // fee payer — payment wallet has SOL from fundPaymentWallet()
    USDC_MINT,
    vault,
  );

  const sourceATA = await getAssociatedTokenAddress(USDC_MINT, paymentKP.publicKey);

  const tx = new Transaction().add(
    createTransferInstruction(
      sourceATA,
      destATA.address,
      paymentKP.publicKey,
      usdcAmount,
    ),
  );

  return sendAndConfirmTransaction(conn, tx, [paymentKP]);
}
