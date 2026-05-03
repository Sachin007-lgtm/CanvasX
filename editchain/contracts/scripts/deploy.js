const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying EditChainNFT with account:", deployer.address);

  const EditChainNFT = await hre.ethers.getContractFactory("EditChainNFT");
  const contract = await EditChainNFT.deploy(deployer.address);

  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("EditChainNFT deployed to:", address);
  console.log("Save this in your .env as CONTRACT_ADDRESS=" + address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
