'use client';
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const stakingContractAddress = '0x765Fc660e2E9863171e8A3Bd09eFF093579B37a7'; // άλλαξέ το αν έχεις νέο
const stakingContractABI = [ [
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_token",
				"type": "address"
			}
		],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"inputs": [],
		"name": "claim",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "user",
				"type": "address"
			}
		],
		"name": "getUserInfo",
		"outputs": [
			{
				"components": [
					{
						"internalType": "uint256",
						"name": "amount",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "start",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "plan",
						"type": "uint256"
					},
					{
						"internalType": "bool",
						"name": "claimed",
						"type": "bool"
					}
				],
				"internalType": "struct ApeXplorerStaking.StakeInfo",
				"name": "",
				"type": "tuple"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "owner",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "plan",
				"type": "uint256"
			}
		],
		"name": "stake",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "stakes",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "start",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "plan",
				"type": "uint256"
			},
			{
				"internalType": "bool",
				"name": "claimed",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "token",
		"outputs": [
			{
				"internalType": "contract IERC20",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}

]];

export default function Home() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [plan, setPlan] = useState('30');
  const [status, setStatus] = useState('');

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setAddress(accounts[0]);
        setWalletConnected(true);
      } catch (err) {
        console.error(err);
      }
    } else {
      alert('Please install MetaMask!');
    }
  };

  const handleStake = async () => {
    try {
      setStatus('Staking in progress...');
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(stakingContractAddress, stakingContractABI, signer);
      const tx = await contract.stake(ethers.parseUnits(amount, 18), parseInt(plan));
      await tx.wait();
      setStatus('✅ Stake successful!');
    } catch (err) {
      console.error(err);
      setStatus('❌ Error during staking.');
    }
  };

  return (
    <main className="p-10">
      <h1 className="text-3xl font-bold mb-4">ApeXplorer Staking UI</h1>

      {!walletConnected ? (
        <button onClick={connectWallet} className="bg-blue-600 text-white px-4 py-2 rounded">
          Connect Wallet
        </button>
      ) : (
        <div>
          <p className="mb-4">Connected: {address}</p>

          <div className="mb-2">
            <label className="block mb-1">Amount to Stake (APE-X):</label>
            <input
              type="number"
              className="border p-2 w-full"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="mb-4">
            <label className="block mb-1">Select Plan:</label>
            <select
              className="border p-2 w-full"
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
            >
              <option value="30">30 sec (2%)</option>
              <option value="60">60 sec (4%)</option>
              <option value="90">90 sec (6%)</option>
            </select>
          </div>

          <button onClick={handleStake} className="bg-green-600 text-white px-4 py-2 rounded">
            Stake
          </button>

          <p className="mt-4">{status}</p>
        </div>
      )}
    </main>
  );
}
