'use client';

import { useState, useEffect, useMemo } from 'react';
import { ethers } from 'ethers';
import { Zen_Dots, Raleway } from 'next/font/google'; 
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi'; 
import { useEthersSigner } from './hooks/useEthersSigner'; 

// --- FONTS ---
const zenDots = Zen_Dots({ subsets: ['latin'], weight: ['400'] });
const raleway = Raleway({ subsets: ['latin'], weight: ['300'] });

// --- CONFIGURATION ---
const TOKEN_ADDR = '0x54053AAcc934a95679582E6e990a9e718E96E6E1'; // AXPR Token
const STAKING_ADDR = '0xdeC85326147C79c2b06a27f8C50AFe7662869a5d'; // Staking Contract
const RPC_URL = "https://bsc-dataseed.binance.org/";
const PINKSALE_LINK = "#"; // <--- ΘΥΜΗΣΟΥ ΝΑ ΤΟ ΑΛΛΑΞΕΙΣ ΟΤΑΝ ΕΧΕΙΣ ΤΟ LINK

// --- ABIS ---
const STAKING_ABI = [
  "function stake(uint256 planIndex, uint256 amount) external",
  "function withdraw(uint256 index) external",
  "function emergencyWithdraw(uint256 index) external",
  "function getUserPositions(address user) external view returns (tuple(uint256 planIndex, uint256 amount, uint256 startTime, uint256 unlockTime, uint256 rewardAmount, bool withdrawn)[])",
  "function getExcessTokens() external view returns (uint256)"
];

const TOKEN_ABI = [
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function allowance(address owner, address spender) public view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)"
];

// --- HELPER: SAFE NUMBER FORMATTER ---
const formatNum = (val) => {
    const n = Number(val);
    if (!Number.isFinite(n)) return "0"; 
    return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 6 });
};

// --- COMPONENT: POSITION CARD ---
const PositionCard = ({ position, onWithdraw, onEmergency, loading }) => {
    const [timeLeft, setTimeLeft] = useState('CALCULATING...');
    const [isLocked, setIsLocked] = useState(true);
    const [accruedReward, setAccruedReward] = useState('0.000000');
    const [progressPercent, setProgressPercent] = useState(0);

    const timesStyle = { fontFamily: '"Times New Roman", Times, serif', fontWeight: '300', letterSpacing: '0.02em' };

    useEffect(() => {
        const timer = setInterval(() => {
            const now = Math.floor(Date.now() / 1000);
            const start = Number(position.startTime);
            const end = Number(position.unlockTime);
            
            const diff = end - now;
            const totalDuration = end - start;
            const elapsed = now - start;

            if (diff <= 0) {
                // UNLOCKED
                setTimeLeft('UNLOCKED');
                setIsLocked(false);
                setAccruedReward(ethers.formatUnits(position.rewardAmount, 18));
                setProgressPercent(100);
                clearInterval(timer);
            } else {
                // LOCKED
                const d = Math.floor(diff / 86400);
                const h = Math.floor((diff % 86400) / 3600);
                const m = Math.floor((diff % 3600) / 60);
                const s = diff % 60;
                setTimeLeft(`${d}d ${h}h ${m}m ${s}s`);
                setIsLocked(true);

                // Progress Calculation
                let progress = 0;
                if (totalDuration > 0) progress = elapsed / totalDuration;
                if (progress < 0) progress = 0;
                if (progress > 1) progress = 1;

                setProgressPercent(progress * 100);

                // Accrued Calculation
                const totalReward = parseFloat(ethers.formatUnits(position.rewardAmount, 18));
                const current = totalReward * progress;
                setAccruedReward(current.toFixed(6));
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [position]);

    return (
        <div className="mt-4 p-5 bg-blue-900/10 rounded-3xl border border-blue-500/20 backdrop-blur-md shadow-inner animate-fade-in relative overflow-hidden">
            {/* ID Badge */}
            <div className="absolute top-0 right-0 bg-blue-600/20 px-3 py-1 rounded-bl-xl text-[8px] text-blue-300 font-bold border-l border-b border-blue-500/30 font-mono">
                ID: #{Number(position.realIndex) + 1}
            </div>

            {/* Header */}
            <div className="flex justify-between items-center mb-4">
                <p className={`${zenDots.className} text-blue-400 text-[10px] tracking-[0.2em] uppercase`}>
                    {position.apy}% Fixed Plan
                </p>
                <div className={`h-2 w-2 rounded-full shadow-[0_0_10px] ${!isLocked ? 'bg-green-500 shadow-green-500' : 'bg-amber-500 shadow-amber-500'} animate-pulse`}></div>
            </div>

            {/* Timer Box */}
            <div className="mb-5 text-center p-3 bg-black/40 rounded-2xl border border-white/5 relative overflow-hidden">
                <div 
                    className="absolute inset-0 bg-blue-500/20 transition-all duration-1000 ease-linear" 
                    style={{ width: `${progressPercent.toFixed(2)}%` }} 
                ></div>
                <div className="relative z-10">
                    <p className="text-[9px] text-gray-500 uppercase font-light tracking-widest mb-1">Time Remaining</p>
                    <p style={{...timesStyle, fontSize: '1.1rem'}} className={`tracking-normal zen_dots ${!isLocked ? 'text-green-400' : 'text-white'}`}>
                        {timeLeft}
                    </p>
                </div>
            </div>

            {/* Stats */}
            <div className="space-y-3 text-[12px] font-light mb-5">
                <div className="flex justify-between text-gray-400 border-b border-white/5 pb-2 uppercase tracking-tight">
                    Staked: <span style={{...timesStyle}} className="text-white text-sm">{formatNum(ethers.formatUnits(position.amount, 18))} AXPR</span>
                </div>
                <div className="flex justify-between items-center font-bold text-white pt-1 uppercase tracking-tight">
                    <div>
                        <span className="text-gray-400 text-[10px]">Accrued (Locked):</span>
                        <span className="block text-[8px] text-blue-400 font-light tracking-wider">{progressPercent.toFixed(1)}% Completed</span>
                    </div>
                    <span style={{...timesStyle}} className="text-purple-400 text-lg">+{formatNum(accruedReward)}</span>
                </div>
                <p className="text-[8px] text-gray-600 text-right italic">*Paid upon unlock</p>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-1 gap-2">
                <button 
                    onClick={() => onWithdraw(position.realIndex)} 
                    disabled={loading || isLocked} 
                    className={`w-full py-3 rounded-xl font-medium border text-[10px] uppercase tracking-[0.2em] transition-all
                    ${isLocked 
                        ? 'bg-gray-800/50 text-gray-500 border-gray-700 cursor-not-allowed' 
                        : 'bg-green-900/20 border-green-500/30 text-green-400 hover:bg-green-900/40 hover:text-white shadow-[0_0_15px_rgba(34,197,94,0.2)]'}`}
                >
                    {isLocked ? "LOCKED" : "CLAIM REWARDS & UNSTAKE"}
                </button>

                <button 
                    onClick={() => {
                        if(confirm("⚠️ WARNING: Emergency Withdraw forfeits ALL rewards. You only get your principal back. Continue?")) {
                            onEmergency(position.realIndex);
                        }
                    }} 
                    disabled={loading}
                    className="w-full py-2 rounded-xl font-medium border border-red-500/10 text-[9px] text-red-500/60 hover:text-red-400 hover:bg-red-900/20 hover:border-red-500/30 transition-all uppercase tracking-widest"
                >
                    Emergency Exit
                </button>
            </div>
        </div>
    );
};

// --- MAIN PAGE ---
export default function Home() {
  // 🟢 FIX: PREVENT HYDRATION ERROR (indexedDB)
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [activeTab, setActiveTab] = useState('STAKE'); 
  const [amount, setAmount] = useState('');
  const [tier, setTier] = useState(0); 
  const [userStakes, setUserStakes] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  
  // Stats
  const [tokenPrice, setTokenPrice] = useState(0);
  const [userBalance, setUserBalance] = useState('0');
  const [marketCap, setMarketCap] = useState(0);

  const { address, isConnected } = useAccount();
  const signer = useEthersSigner(); 

  // --- MEMOIZED PROVIDER ---
  const provider = useMemo(() => new ethers.JsonRpcProvider(RPC_URL), []);

  // --- REFRESH DATA ---
  const refreshData = async () => {
    if(!address) return;
    
    try {
        const token = new ethers.Contract(TOKEN_ADDR, TOKEN_ABI, provider);
        const bal = await token.balanceOf(address);
        setUserBalance(ethers.formatUnits(bal, 18));
    } catch(e) { }

    try {
        const staking = new ethers.Contract(STAKING_ADDR, STAKING_ABI, provider);
        const positions = await staking.getUserPositions(address);
        
        const apys = { 0: "8", 1: "12", 2: "16" };
        const activeStakes = [];

        for (let i = 0; i < positions.length; i++) {
            if (!positions[i].withdrawn) {
                activeStakes.push({
                    realIndex: i, 
                    planIndex: positions[i].planIndex,
                    amount: positions[i].amount,
                    startTime: positions[i].startTime,
                    unlockTime: positions[i].unlockTime,
                    rewardAmount: positions[i].rewardAmount,
                    apy: apys[positions[i].planIndex] || "8"
                });
            }
        }
        setUserStakes(activeStakes.reverse());
    } catch(e) { }
  };

  useEffect(() => {
    if (isConnected && address) {
        refreshData();
    } else {
        setUserStakes([]);
        setUserBalance('0');
    }
  }, [address, isConnected, provider]);

  // --- STATS LOOP ---
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
        } catch (e) { }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, []);

  // --- ALLOWANCE CHECK ---
  useEffect(() => {
    if (!isConnected || !address || !amount) {
        setIsApproved(false);
        return;
    }
    const timeoutId = setTimeout(() => {
        checkAllowance();
    }, 500); 
    return () => clearTimeout(timeoutId);
  }, [amount, address, isConnected, provider]);

  const checkAllowance = async () => {
    try {
        if (!amount || isNaN(amount) || Number(amount) <= 0) {
            setIsApproved(false);
            return;
        }
        const tokenContract = new ethers.Contract(TOKEN_ADDR, TOKEN_ABI, provider);
        const allowance = await tokenContract.allowance(address, STAKING_ADDR);
        const amountWei = ethers.parseUnits(amount, 18);
        if (allowance >= amountWei) setIsApproved(true);
        else setIsApproved(false);
    } catch (e) { }
  };

  const handleMax = () => {
      if(!userBalance || userBalance === '0') return;
      setAmount(userBalance);
  };

  // --- TX HANDLERS (UPDATED FOR MOBILE) ---
  const handleApprove = async () => {
    if (!signer) return;
    setLoading(true);

    // 📢 Ειδοποίηση για το κινητό
    alert("⚠️ ΠΡΟΣΟΧΗ:\n\nΤώρα θα ανοίξει το Πορτοφόλι σας.\nΠαρακαλώ πατήστε 'Confirm' ή 'Approve' εκεί.");

    try {
      const token = new ethers.Contract(TOKEN_ADDR, TOKEN_ABI, signer);
      const tx = await token.approve(STAKING_ADDR, ethers.MaxUint256);
      
      alert("⏳ Η εντολή στάλθηκε! Περιμένετε...");
      
      await tx.wait(); 
      alert("✅ Approved Successfully! Τώρα πατήστε STAKE.");
      setIsApproved(true);
    } catch (e) { 
        console.error(e);
        alert("❌ Η έγκριση ακυρώθηκε."); 
    }
    setLoading(false);
  };

  const handleStake = async () => {
    if (!signer) return;
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
        alert("Please enter a valid amount greater than 0");
        return;
    }
    setLoading(true);

    // 📢 Ειδοποίηση για το κινητό
    alert("⚠️ ΠΡΟΣΟΧΗ:\n\nΕλέγξτε το Πορτοφόλι σας για να επιβεβαιώσετε το Staking.");

    try {
      const stakeContract = new ethers.Contract(STAKING_ADDR, STAKING_ABI, signer);
      const tx = await stakeContract.stake(tier, ethers.parseUnits(amount, 18));
      
      alert("⏳ Η συναλλαγή Stake στάλθηκε!");
      
      await tx.wait(); 
      alert("✅ Staked Successfully!");
      setAmount('');
      setIsApproved(false);
      refreshData(); 
    } catch (e) { 
        console.error(e);
        const msg = (e?.reason || e?.shortMessage || e?.message || "").toLowerCase();
        if (msg.includes("insufficient rewards")) {
            alert("❌ Pool has insufficient rewards reserved.");
        } else {
            alert("❌ Stake Failed. Check console.");
        }
    }
    setLoading(false);
  };

  const handleWithdraw = async (index) => {
    if (!signer) return;
    setLoading(true);
    try {
      const stakeContract = new ethers.Contract(STAKING_ADDR, STAKING_ABI, signer);
      const tx = await stakeContract.withdraw(index);
      await tx.wait(); 
      alert("🎉 Claimed!");
      refreshData();
    } catch (e) { 
        alert("❌ Withdraw Failed."); 
    }
    setLoading(false);
  };

  const handleEmergencyWithdraw = async (index) => {
    if (!signer) return;
    setLoading(true);
    try {
      const stakeContract = new ethers.Contract(STAKING_ADDR, STAKING_ABI, signer);
      const tx = await stakeContract.emergencyWithdraw(index);
      await tx.wait(); 
      alert("⚠️ Emergency Exit Successful.");
      refreshData();
    } catch (e) { 
        alert("❌ Emergency Failed."); 
    }
    setLoading(false);
  };

  // 🟢 FIX: Return NULL if on server to avoid indexedDB error
  if (!mounted) return null;

  return (
    <div className={`relative min-h-screen flex items-center justify-center bg-black text-white px-4 overflow-hidden ${raleway.className}`}>
      
      <div className="absolute inset-0 z-0 flex items-center justify-center opacity-30 pointer-events-none" 
        style={{ backgroundImage: "url('/logo.png')", backgroundSize: '70%', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }}>
      </div>

      <div className="relative z-10 w-full max-w-md p-6 bg-black/60 backdrop-blur-3xl rounded-[3rem] shadow-[0_0_80px_rgba(0,0,0,0.9)] border border-white/10 flex flex-col items-center max-h-[90vh] overflow-y-auto custom-scrollbar">
        
        <div className="mb-4 shrink-0">
          <img src="/logo.png" alt="Apex" className="w-24 h-24 object-contain" />
        </div>

        <h1 className={`${zenDots.className} text-lg text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600 mb-4 text-center shrink-0`}>
          ApeXplorer App
        </h1>

        <div className="mb-6 scale-90 shrink-0">
            <ConnectButton showBalance={false} />
        </div>

        <div className={`flex w-full bg-white/5 rounded-full p-1 mb-6 shrink-0 transition-all duration-500 ${!isConnected ? 'opacity-30 pointer-events-none grayscale' : 'opacity-100'}`}>
            <button onClick={() => setActiveTab('STAKE')} className={`flex-1 py-2 rounded-full text-[10px] font-bold tracking-widest transition-all ${activeTab === 'STAKE' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>STAKE</button>
            <button onClick={() => setActiveTab('BUY')} className={`flex-1 py-2 rounded-full text-[10px] font-bold tracking-widest transition-all ${activeTab === 'BUY' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>BUY</button>
            <button onClick={() => setActiveTab('TRACK')} className={`flex-1 py-2 rounded-full text-[10px] font-bold tracking-widest transition-all ${activeTab === 'TRACK' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>TRACK</button>
        </div>

        {!isConnected ? (
            <div className="w-full py-10 flex flex-col items-center justify-center space-y-4 animate-fade-in border border-white/5 rounded-3xl bg-white/5">
                <div className="text-4xl">🔐</div>
                <p className={`${zenDots.className} text-gray-400 text-xs tracking-widest`}>PROTOCOL LOCKED</p>
                <p className="text-[10px] text-gray-500 font-light text-center px-6">Connect your wallet above to access Staking, Trading & Portfolio Tracking.</p>
            </div>
        ) : (
            <>
                {activeTab === 'STAKE' && (
                    <div className="w-full space-y-5 animate-fade-in pb-4">
                        <div className="p-4 bg-white/5 rounded-3xl border border-white/5 shadow-lg">
                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] text-gray-400 ml-2 uppercase tracking-wider">Amount (AXPR)</label>
                                    <input 
                                        type="number" 
                                        min="0" 
                                        placeholder="0.0" 
                                        className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white outline-none focus:border-blue-500 transition-colors" 
                                        value={amount} 
                                        onChange={(e) => {
                                            if (Number(e.target.value) >= 0) setAmount(e.target.value);
                                        }} 
                                    />
                                    <div className="text-right pr-2">
                                        <button onClick={handleMax} className="text-[9px] text-blue-400 cursor-pointer hover:text-white uppercase tracking-widest hover:underline">
                                            Max: {formatNum(userBalance)}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-gray-400 ml-2 uppercase tracking-wider">Lock Plan</label>
                                    <select className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white outline-none cursor-pointer hover:bg-white/5 transition-colors" 
                                    value={tier} onChange={(e) => setTier(Number(e.target.value))}>
                                        <option value={0}>2 Months — 8% Fixed Return</option>
                                        <option value={1}>4 Months — 12% Fixed Return</option>
                                        <option value={2}>6 Months — 16% Fixed Return</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-3 pt-2">
                                    <button onClick={handleApprove} disabled={loading || isApproved} className={`py-3 rounded-xl font-bold text-[10px] tracking-widest border transition-all duration-300 ${isApproved ? 'bg-gray-800 text-green-500 border-green-500/30' : 'bg-amber-600 text-white border-amber-500/20 hover:bg-amber-500'}`}>
                                        {loading ? "..." : (isApproved ? "APPROVED" : "APPROVE")}
                                    </button>
                                    <button onClick={handleStake} disabled={loading || !isApproved} className={`py-3 rounded-xl font-bold text-[10px] tracking-widest border transition-all duration-300 ${isApproved ? 'bg-green-600 text-white border-green-500/50 hover:bg-green-500 shadow-[0_0_20px_rgba(22,163,74,0.4)]' : 'bg-gray-800 text-gray-500 border-white/5'}`}>
                                        STAKE
                                    </button>
                                </div>
                            </div>
                        </div>

                        {userStakes.length > 0 && (
                            <div className="w-full">
                                <div className="flex items-center gap-2 mb-2 ml-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                                    <p className="text-[10px] text-gray-400 uppercase tracking-widest">Your Active Stakes</p>
                                </div>
                                {userStakes.map((stake) => (
                                    <PositionCard 
                                        key={stake.realIndex} 
                                        position={stake} 
                                        onWithdraw={handleWithdraw} 
                                        onEmergency={handleEmergencyWithdraw}
                                        loading={loading}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'BUY' && (
                    <div className="w-full animate-fade-in flex flex-col items-center">
                         <div className="w-full p-4 mb-4 bg-gradient-to-r from-pink-600/20 to-purple-600/20 border border-pink-500/30 rounded-2xl text-center">
                            <p className="text-[10px] text-pink-300 uppercase tracking-widest mb-2">Presale Phase</p>
                            <p className="text-xs text-gray-300 mb-3">Liquidity will be added soon. Buy via PinkSale.</p>
                            <a href={PINKSALE_LINK} target="_blank" className="block w-full py-3 bg-pink-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-pink-500 transition-all text-white shadow-[0_0_15px_rgba(219,39,119,0.4)]">
                                Go to PinkSale
                            </a>
                        </div>
                        <div className="w-full h-[300px] border border-white/5 rounded-2xl bg-black/40 flex flex-col items-center justify-center text-gray-600">
                             <div className="text-4xl mb-2">🥞</div>
                             <p className="text-[10px] uppercase tracking-widest">PancakeSwap Trading</p>
                             <p className="text-[9px] mt-1">Coming After Launch</p>
                        </div>
                    </div>
                )}

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
                                    <p className="text-sm font-bold text-blue-400">{formatNum(userBalance)} AXPR</p>
                                </div>
                                <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                                    <p className="text-[8px] text-gray-400 uppercase">AXPR Price</p>
                                    <p className="text-sm font-bold text-green-400">${tokenPrice > 0 ? tokenPrice.toFixed(6) : '---'}</p>
                                </div>
                            </div>
                        </div>
                        <div className="w-full rounded-3xl overflow-hidden border border-white/10 h-[300px] relative bg-black/50">
                            <iframe 
                                src={`https://dexscreener.com/bsc/${TOKEN_ADDR}?embed=1&theme=dark&trades=0&info=0`}
                                width="100%" height="100%" frameBorder="0"
                            ></iframe>
                        </div>
                    </div>
                )}
            </>
        )}
      </div>
    </div>
  );
}