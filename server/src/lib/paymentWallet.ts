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

export function generatePaymentWallet(): { address: string; privateKey: string } {
  const kp = Keypair.generate();
  return {
    address: kp.publicKey.toBase58(),
    privateKey: Buffer.from(kp.secretKey).toString("base64"),
  };
}

export function restoreKeypair(privateKeyBase64: string): Keypair {
  return Keypair.fromSecretKey(Buffer.from(privateKeyBase64, "base64"));
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
