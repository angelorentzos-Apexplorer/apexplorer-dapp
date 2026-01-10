'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Zen_Dots, Raleway } from 'next/font/google'; 
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi'; 
import { useEthersSigner } from './hooks/useEthersSigner'; 

// --- FONTS ---
const zenDots = Zen_Dots({ subsets: ['latin'], weight: ['400'] });
const raleway = Raleway({ subsets: ['latin'], weight: ['300'] });

// --- ADDRESSES ---
const TOKEN_ADDR = '0x03e2cfdC84c13d813ab42d95424b9966d2424E24';
const STAKING_ADDR = '0xaB5bcb701c505aEc5Be024F2CA218e272b685106';

// --- ABIS ---
const STAKING_ABI = [
  "function stake(uint256 _amount, uint8 _tier) external",
  "function withdraw() external",
  "function calculateReward(address _user) public view returns (uint256)",
  "function stakes(address) public view returns (uint256 amount, uint256 startTime, uint256 duration, uint256 apy, uint256 reward, bool active)"
];

const TOKEN_ABI = [
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function allowance(address owner, address spender) public view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)"
];

export default function Home() {
  // --- STATE ---
  const [activeTab, setActiveTab] = useState('STAKE'); 
  const [amount, setAmount] = useState('');
  const [tier, setTier] = useState(0);
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  const [isApproved, setIsApproved] = useState(false);
  
  // Stats
  const [tokenPrice, setTokenPrice] = useState(0);
  const [userBalance, setUserBalance] = useState('0');
  const [marketCap, setMarketCap] = useState(0);

  // --- HOOKS ---
  const { address, isConnected } = useAccount();
  const signer = useEthersSigner(); 

  const timesStyle = { 
    fontFamily: '"Times New Roman", Times, serif',
    fontWeight: '300',
    letterSpacing: '0.02em'
  };

  // --- LOGIC ---
  useEffect(() => {
    if (isConnected && address) {
      const provider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
      const contract = new ethers.Contract(STAKING_ADDR, STAKING_ABI, provider);
      fetchUserInfo(contract, address);
      fetchUserBalance(address, provider);
    } else {
        setUserInfo(null);
        setUserBalance('0');
    }
  }, [address, isConnected]);

  useEffect(() => {
    const fetchStats = async () => {
        try {
            const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${TOKEN_ADDR}`);
            const data = await res.json();
            if (data.pairs && data.pairs.length > 0) {
                const pair = data.pairs[0];
                setTokenPrice(Number(pair.priceUsd));
                setMarketCap(pair.fdv);
            }
        } catch (e) { console.error("Price fetch error"); }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchUserBalance = async (userAddr, provider) => {
      try {
        const tokenContract = new ethers.Contract(TOKEN_ADDR, TOKEN_ABI, provider);
        const bal = await tokenContract.balanceOf(userAddr);
        setUserBalance(ethers.formatUnits(bal, 18));
      } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (isConnected && address && amount) {
        checkAllowance();
    } else {
        setIsApproved(false);
    }
  }, [amount, address, isConnected]);

  useEffect(() => {
    if (!userInfo || !userInfo.active) {
        setTimeLeft('');
        return;
    }
    const timer = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const end = Number(userInfo.startTime) + Number(userInfo.duration);
      const diff = end - now;
      if (diff <= 0) { 
          setTimeLeft('Unlocked'); 
          clearInterval(timer); 
      } else {
        const d = Math.floor(diff/86400); 
        const h = Math.floor((diff%86400)/3600);
        const m = Math.floor((diff%3600)/60); 
        const s = diff%60;
        setTimeLeft(`${d}d ${h}hrs ${m}min ${s}sec`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [userInfo]);

  const checkAllowance = async () => {
    try {
        if (!amount || isNaN(amount)) return;
        const provider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
        const tokenContract = new ethers.Contract(TOKEN_ADDR, TOKEN_ABI, provider);
        const allowance = await tokenContract.allowance(address, STAKING_ADDR);
        const amountWei = ethers.parseUnits(amount, 18);
        if (allowance >= amountWei) setIsApproved(true);
        else setIsApproved(false);
    } catch (e) { console.error(e); }
  };

  const fetchUserInfo = async (contract, userAddr) => {
    try {
      const data = await contract.stakes(userAddr);
      const parsedInfo = {
          amount: data[0],
          startTime: data[1],
          duration: data[2],
          apy: data[3],
          reward: data[4],
          active: data[5] 
      };
      let currentReward = 0n;
      if (parsedInfo.active) {
          try { currentReward = await contract.calculateReward(userAddr); } catch(err) {}
      }
      setUserInfo({ 
          amount: parsedInfo.amount, 
          startTime: parsedInfo.startTime, 
          duration: parsedInfo.duration, 
          apy: parsedInfo.apy, 
          active: parsedInfo.active,
          pendingReward: currentReward 
      });
    } catch (e) { console.error(e); }
  };

  // --- HANDLERS ---
  const handleApprove = async () => {
    if (!signer) return;
    setLoading(true);
    try {
      const token = new ethers.Contract(TOKEN_ADDR, TOKEN_ABI, signer);
      const tx = await token.approve(STAKING_ADDR, ethers.parseUnits("1000000000", 18));
      await tx.wait(); 
      alert("✅ Approved!");
      setIsApproved(true);
    } catch (e) { alert("❌ Failed"); }
    setLoading(false);
  };

  const handleStake = async () => {
    if (!signer || !amount) return alert("Enter amount");
    setLoading(true);
    try {
      const stakeContract = new ethers.Contract(STAKING_ADDR, STAKING_ABI, signer);
      const tx = await stakeContract.stake(ethers.parseUnits(amount, 18), tier);
      await tx.wait(); 
      alert("✅ Staked!");
      setAmount('');
      setIsApproved(false);
      fetchUserInfo(stakeContract, address);
      const provider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
      fetchUserBalance(address, provider);
    } catch (e) { alert("❌ Failed (Active stake exists?)"); }
    setLoading(false);
  };

  const handleWithdraw = async () => {
    if (!signer) return;
    setLoading(true);
    try {
      const stakeContract = new ethers.Contract(STAKING_ADDR, STAKING_ABI, signer);
      const tx = await stakeContract.withdraw();
      await tx.wait(); 
      alert("🎉 Claimed!");
      fetchUserInfo(stakeContract, address);
      const provider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
      fetchUserBalance(address, provider);
    } catch (e) { alert("❌ Failed (Locked?)"); }
    setLoading(false);
  };

  return (
    <div className={`relative min-h-screen flex items-center justify-center bg-black text-white px-4 overflow-hidden ${raleway.className}`}>
      
      {/* BG */}
      <div className="absolute inset-0 z-0 flex items-center justify-center opacity-30 pointer-events-none" 
        style={{ backgroundImage: "url('/logo.png')", backgroundSize: '70%', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }}>
      </div>

      <div className="relative z-10 w-full max-w-md p-6 bg-black/60 backdrop-blur-3xl rounded-[3rem] shadow-[0_0_80px_rgba(0,0,0,0.9)] border border-white/10 flex flex-col items-center">
        
        {/* LOGO */}
        <div className="mb-4">
          <img src="/logo.png" alt="Apex" className="w-34 h-34 object-contain" />
        </div>

        {/* HEADER */}
        <h1 className={`${zenDots.className} text-lg text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600 mb-4 text-center`}>
          ApeXplorer App
        </h1>

        {/* 1. CONNECT BUTTON */}
        <div className="mb-8 scale-90">
            <ConnectButton showBalance={false} />
        </div>

        {/* 2. NAVIGATION TABS */}
        <div className={`flex w-full bg-white/5 rounded-full p-1 mb-6 transition-all duration-500 ${!isConnected ? 'opacity-30 pointer-events-none grayscale' : 'opacity-100'}`}>
            <button onClick={() => setActiveTab('STAKE')} className={`flex-1 py-2 rounded-full text-[10px] font-bold tracking-widest transition-all ${activeTab === 'STAKE' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>STAKE</button>
            <button onClick={() => setActiveTab('BUY')} className={`flex-1 py-2 rounded-full text-[10px] font-bold tracking-widest transition-all ${activeTab === 'BUY' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>BUY</button>
            <button onClick={() => setActiveTab('TRACK')} className={`flex-1 py-2 rounded-full text-[10px] font-bold tracking-widest transition-all ${activeTab === 'TRACK' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>TRACK</button>
        </div>

        {/* 3. MAIN CONTENT AREA */}
        {!isConnected ? (
            <div className="w-full py-10 flex flex-col items-center justify-center space-y-4 animate-fade-in border border-white/5 rounded-3xl bg-white/5">
                <div className="text-4xl">🔐</div>
                <p className={`${zenDots.className} text-gray-400 text-xs tracking-widest`}>PROTOCOL LOCKED</p>
                <p className="text-[10px] text-gray-500 font-light text-center px-6">Connect your wallet above to access Staking, Trading & Portfolio Tracking.</p>
            </div>
        ) : (
            <>
                {/* --- STAKE TAB --- */}
                {activeTab === 'STAKE' && (
                    <div className="w-full space-y-5 animate-fade-in">
                        {(!userInfo || !userInfo.active) ? (
                            <>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-gray-400 ml-2 uppercase tracking-wider">Amount</label>
                                    <input 
                                        type="number" 
                                        min="0" 
                                        placeholder="0.0" 
                                        className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white outline-none focus:border-blue-500" 
                                        value={amount} 
                                        onChange={(e) => {
                                            if (Number(e.target.value) >= 0) setAmount(e.target.value);
                                        }} 
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-gray-400 ml-2 uppercase tracking-wider">Plan</label>
                                    <select className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white outline-none" 
                                    value={tier} onChange={(e) => setTier(Number(e.target.value))}>
                                        <option value={0}>2 Months — 8% APY</option>
                                        <option value={1}>4 Months — 12% APY</option>
                                        <option value={2}>6 Months — 16% APY</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={handleApprove} disabled={loading || isApproved} className={`py-3 rounded-xl font-bold text-[10px] tracking-widest border ${isApproved ? 'bg-gray-800 text-green-500 border-green-500/30' : 'bg-amber-600 text-white border-amber-500/20'}`}>
                                        {loading ? "..." : (isApproved ? "APPROVED" : "APPROVE")}
                                    </button>
                                    <button onClick={handleStake} disabled={loading || !isApproved} className={`py-3 rounded-xl font-bold text-[10px] tracking-widest border ${isApproved ? 'bg-green-600 text-white border-green-500/50' : 'bg-gray-800 text-gray-500 border-white/5'}`}>
                                        STAKE
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="mt-4 p-6 bg-blue-900/10 rounded-3xl border border-blue-500/20 backdrop-blur-md shadow-inner animate-fade-in">
                                <div className="flex justify-between items-center mb-4">
                                    <p className={`${zenDots.className} text-blue-400 text-[10px] tracking-[0.2em] uppercase`}>Active Position</p>
                                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_#22c55e]"></div>
                                </div>
                                <div className="mb-5 text-center p-4 bg-black/40 rounded-2xl border border-white/5">
                                    <p className="text-[9px] text-gray-500 uppercase font-light tracking-widest mb-1">Unlock In</p>
                                    <p style={{...timesStyle, fontSize: '1.2rem'}} className="text-white tracking-normal zen_dots">{timeLeft}</p>
                                </div>
                                <div className="space-y-3 text-[13px] font-light">
                                    <div className="flex justify-between text-gray-400 border-b border-white/5 pb-2 uppercase tracking-tight">
                                    Staked: <span style={{...timesStyle, fontSize: '1.1rem'}} className="text-white">{ethers.formatUnits(userInfo.amount, 18)} APEX</span>
                                    </div>
                                    <div className="flex justify-between text-gray-400 border-b border-white/5 pb-2 uppercase tracking-tight">
                                    APY Rate: <span style={{...timesStyle, fontSize: '1.1rem'}} className="text-green-400">{Number(userInfo.apy)}%</span>
                                    </div>
                                    <div className="flex justify-between font-bold text-white pt-2 uppercase tracking-tight">
                                    Earnings: <span style={{...timesStyle, fontSize: '1.1rem'}} className="text-purple-400">+{ethers.formatUnits(userInfo.pendingReward, 18)}</span>
                                    </div>
                                </div>
                                <button onClick={handleWithdraw} disabled={loading} className="w-full mt-6 bg-red-900/20 py-3 rounded-2xl font-medium border border-red-500/30 text-[10px] text-red-400 hover:bg-red-900/40 hover:text-white transition-all uppercase tracking-[0.2em]">
                                    Claim Rewards & Unstake
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* --- BUY TAB --- */}
                {activeTab === 'BUY' && (
                    <div className="w-full animate-fade-in flex flex-col items-center">
                        <div className="w-full p-4 mb-4 bg-gradient-to-r from-pink-600/20 to-purple-600/20 border border-pink-500/30 rounded-2xl text-center">
                            <p className="text-[10px] text-pink-300 uppercase tracking-widest mb-2">Presale Phase</p>
                            <p className="text-xs text-gray-300 mb-3">Liquidity has not been added yet. Buy via PinkSale.</p>
                            <a href="#" target="_blank" className="block w-full py-3 bg-pink-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-pink-500 transition-all">
                                Go to PinkSale
                            </a>
                        </div>
                        <div className="w-full rounded-2xl overflow-hidden border border-white/10 shadow-lg">
                            <iframe 
                                src={`https://pancakeswap.finance/swap?outputCurrency=${TOKEN_ADDR}`}
                                width="100%" height="350px" frameBorder="0" title="Swap APEX" style={{ display: 'block' }}
                            />
                        </div>
                        <p className="text-[9px] text-gray-500 mt-2 text-center">Powered by PancakeSwap. Works only after Liquidity Launch.</p>
                    </div>
                )}

                {/* --- TRACK TAB --- */}
                {activeTab === 'TRACK' && (
                    <div className="w-full animate-fade-in space-y-4">
                        <div className="p-5 bg-gradient-to-br from-gray-900 to-black rounded-3xl border border-white/10 shadow-xl">
                            <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Your Portfolio Value</p>
                            <h2 className={`${zenDots.className} text-3xl text-white mb-4`}>
                                ${(Number(userBalance) * tokenPrice).toFixed(2)}
                            </h2>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                                    <p className="text-[8px] text-gray-400 uppercase">Holdings</p>
                                    <p className="text-sm font-bold text-blue-400">{Number(userBalance).toLocaleString()} APEX</p>
                                </div>
                                <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                                    <p className="text-[8px] text-gray-400 uppercase">APEX Price</p>
                                    <p className="text-sm font-bold text-green-400">${tokenPrice > 0 ? tokenPrice.toFixed(6) : '---'}</p>
                                </div>
                            </div>
                        </div>
                        <div className="w-full rounded-3xl overflow-hidden border border-white/10 h-[300px] relative bg-black/50">
                            <iframe 
                                src={`https://dexscreener.com/bsc/${TOKEN_ADDR}?embed=1&theme=dark&trades=0&info=0`}
                                width="100%" height="100%" frameBorder="0"
                            ></iframe>
                            {tokenPrice === 0 && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                                    <p className="text-xs text-gray-400">Chart available after Launch</p>
                                </div>
                            )}
                        </div>
                        <div className="text-center">
                            <p className="text-[9px] text-gray-600">Market Cap (FDV): ${marketCap ? Number(marketCap).toLocaleString() : '---'}</p>
                        </div>
                    </div>
                )}
            </>
        )}

      </div>
    </div>
  );
}