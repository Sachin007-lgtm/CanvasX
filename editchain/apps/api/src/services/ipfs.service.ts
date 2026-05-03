// ============================================================
// IPFS Service (via Pinata)
// Pins JSON design provenance chains to IPFS for decentralized
// accessibility.
// ============================================================

export interface PinataResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

export async function pinToIPFS(payload: unknown, name?: string): Promise<string> {
  const jwt = process.env.PINATA_JWT;
  
  if (!jwt) {
    console.warn("PINATA_JWT not found in environment. Falling back to mock CID.");
    return "QmMockCID" + Math.random().toString(36).substring(7);
  }

  try {
    const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        pinataContent: payload,
        pinataMetadata: {
          name: name || `EditChain-${Date.now()}`,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Pinata API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as PinataResponse;
    return data.IpfsHash;
  } catch (err) {
    console.error("IPFS pinning failed:", err);
    throw new Error("Failed to pin design to IPFS");
  }
}
