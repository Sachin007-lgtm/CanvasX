// ============================================================
// Blockchain Service (Ethers.js)
// Interacts with the deployed EditChainNFT contract on Sepolia
// to mint design provenance as an on-chain NFT.
// ============================================================

import { ethers } from "ethers";

// ABI — only the functions we need
const CONTRACT_ABI = [
  "function mintDesign(address to, bytes32 designId, bytes32 promptHash, bytes32 merkleRoot, string ipfsCid, uint32 totalEdits, string tokenURI_) external returns (uint256)",
  "function getProvenance(uint256 tokenId) external view returns (tuple(bytes32 promptHash, bytes32 editMerkleRoot, string ipfsCid, address creator, uint256 createdAt, uint32 totalEdits))",
  "function verifyEditEvent(uint256 tokenId, bytes32 leaf, bytes32[] proof, uint256 index) external view returns (bool)",
  "event DesignMinted(uint256 indexed tokenId, address indexed creator, bytes32 promptHash, bytes32 editMerkleRoot, string ipfsCid, uint32 totalEdits)",
];

function getContract() {
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  const privateKey = process.env.PRIVATE_KEY;
  const contractAddress = process.env.CONTRACT_ADDRESS;

  if (!rpcUrl || !privateKey || !contractAddress) {
    throw new Error("Missing SEPOLIA_RPC_URL, PRIVATE_KEY, or CONTRACT_ADDRESS in .env");
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);
  return new ethers.Contract(contractAddress, CONTRACT_ABI, signer);
}

export interface MintResult {
  tokenId: string;
  txHash: string;
  blockNumber: number;
  etherscanUrl: string;
}

export async function mintDesignOnChain(params: {
  recipientAddress: string;
  designId: string;         // UUID string
  promptHash: string;       // hex string (64 chars)
  merkleRoot: string;       // hex string (64 chars)
  ipfsCid: string;
  totalEdits: number;
}): Promise<MintResult> {
  const contract = getContract();

  // Convert values to bytes32 (Solidity format)
  const designIdBytes = ethers.id(params.designId);                           // keccak256 of UUID
  const promptHashBytes = "0x" + params.promptHash.replace(/^0x/, "").padEnd(64, "0");
  const merkleRootBytes = "0x" + params.merkleRoot.replace(/^0x/, "").padEnd(64, "0");

  // Token URI points to the IPFS data
  const tokenURI = `ipfs://${params.ipfsCid}`;

  console.log(`Minting design ${params.designId} on Sepolia...`);

  const tx = await contract.mintDesign(
    params.recipientAddress,
    designIdBytes,
    promptHashBytes,
    merkleRootBytes,
    params.ipfsCid,
    params.totalEdits,
    tokenURI
  );

  console.log(`TX submitted: ${tx.hash} — waiting for confirmation...`);
  const receipt = await tx.wait(1); // wait for 1 block confirmation

  // Extract tokenId from DesignMinted event
  const mintEvent = receipt.logs
    .map((log: any) => { try { return contract.interface.parseLog(log); } catch { return null; } })
    .find((e: any) => e?.name === "DesignMinted");

  const tokenId = mintEvent?.args?.tokenId?.toString() ?? "unknown";
  const etherscanUrl = `https://sepolia.etherscan.io/tx/${receipt.hash}`;

  console.log(`✅ Minted! Token ID: ${tokenId} | TX: ${receipt.hash}`);

  return {
    tokenId,
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    etherscanUrl,
  };
}
