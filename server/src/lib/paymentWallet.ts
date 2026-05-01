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
 *   - base58 string  (standard Phantom / Solana CLI export format for the vault key)
 */
export function restoreKeypair(privateKey: string): Keypair {
  // Try base64 first — payment wallets are stored this way
  const b64 = Buffer.from(privateKey, "base64");
  if (b64.length === 64) return Keypair.fromSecretKey(b64);

  // Fall back to base58 (e.g. VAULT_WALLET_PRIVATE_KEY env var)
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

  // USDC
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
  if (amount <= 0) throw new Error("Insufficient balance to sweep");

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: paymentKP.publicKey,
      toPubkey: vault,
      lamports: amount,
    }),
  );

  return sendAndConfirmTransaction(conn, tx, [paymentKP]);
}

// Sweep USDC from payment wallet to vault.
// Vault keypair is needed as fee payer (payment wallet has no SOL).
export async function sweepUSDC(
  paymentWalletPrivateKey: string,
  vaultAddress: string,
  vaultPrivateKey: string,
  usdcAmount: bigint,
): Promise<string> {
  if (!vaultPrivateKey) throw new Error("VAULT_WALLET_PRIVATE_KEY not set");
  const conn = getConnection();
  const paymentKP = restoreKeypair(paymentWalletPrivateKey);
  const vaultKP = restoreKeypair(vaultPrivateKey);
  const vault = new PublicKey(vaultAddress);

  const sourceATA = await getAssociatedTokenAddress(USDC_MINT, paymentKP.publicKey);
  const destATA = await getOrCreateAssociatedTokenAccount(conn, vaultKP, USDC_MINT, vault);

  const tx = new Transaction().add(
    createTransferInstruction(sourceATA, destATA.address, paymentKP.publicKey, usdcAmount),
  );

  // Vault pays fees; payment wallet signs as token authority
  return sendAndConfirmTransaction(conn, tx, [vaultKP, paymentKP]);
}
