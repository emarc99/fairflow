'use client';

import { useState, useEffect } from 'react';
import { useAccount, useBlockNumber, useReadContract, useWriteContract, useSwitchChain, usePublicClient } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { parseEther, formatEther } from 'viem';
import {
  FAIRFLOW_ADDRESS,
  POOL_MANAGER_ADDRESS,
  SWAP_ROUTER_ADDRESS,
  TOKEN0_ADDRESS,
  TOKEN1_ADDRESS,
  POOL_ID,
  POOL_KEY,
  FairFlowAbi,
  PoolSwapTestAbi,
  MockERC20Abi,
} from '@/lib/web3Config';
import FeeBadge from './ui/FeeBadge';

const MODE_MAP = ['Calm', 'Congestion', 'Reversal', 'MatureRisk', 'Counterflow'];

export default function OnChainLivePanel({ onSwapExecuted }) {
  const { address, isConnected, chain } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient();
  const { data: blockNumber } = useBlockNumber({ watch: true });
  const isBaseSepolia = chain?.id === baseSepolia.id;

  const [direction, setDirection] = useState(true); // true = zeroForOne (fUSD -> fETH), false = oneForZero
  const [swapAmount, setSwapAmount] = useState('5');
  const [statusMsg, setStatusMsg] = useState(null);
  const [lastTxHash, setLastTxHash] = useState(null);
  const [isAttacking, setIsAttacking] = useState(false);

  // ─── Read Immutable Hook Parameters ──────────────────────────────────────
  const { data: baseFee } = useReadContract({
    address: FAIRFLOW_ADDRESS,
    abi: FairFlowAbi,
    functionName: 'BASE_FEE',
  });
  const { data: minFee } = useReadContract({
    address: FAIRFLOW_ADDRESS,
    abi: FairFlowAbi,
    functionName: 'MIN_FEE',
  });
  const { data: maxFee } = useReadContract({
    address: FAIRFLOW_ADDRESS,
    abi: FairFlowAbi,
    functionName: 'MAX_FEE',
  });
  const { data: congestionRate } = useReadContract({
    address: FAIRFLOW_ADDRESS,
    abi: FairFlowAbi,
    functionName: 'CONGESTION_FEE_PER_TICK',
  });
  const { data: reversalRate } = useReadContract({
    address: FAIRFLOW_ADDRESS,
    abi: FairFlowAbi,
    functionName: 'REVERSAL_FEE_PER_TICK',
  });
  const { data: counterflowRate } = useReadContract({
    address: FAIRFLOW_ADDRESS,
    abi: FairFlowAbi,
    functionName: 'COUNTERFLOW_DISCOUNT_PER_TICK',
  });
  const { data: volRate } = useReadContract({
    address: FAIRFLOW_ADDRESS,
    abi: FairFlowAbi,
    functionName: 'VOLATILITY_FEE_PER_TICK',
  });

  // ─── Read Live Pool Flow State Directly from Base Sepolia Hook ───────────
  const { data: onChainFlowState, refetch: refetchFlowState } = useReadContract({
    address: FAIRFLOW_ADDRESS,
    abi: FairFlowAbi,
    functionName: 'getFlowState',
    args: [POOL_ID],
    query: { refetchInterval: 3000 },
  });

  // ─── Read User Token Balances ───────────────────────────────────────────
  const { data: bal0, refetch: refetchBal0 } = useReadContract({
    address: TOKEN0_ADDRESS,
    abi: MockERC20Abi,
    functionName: 'balanceOf',
    args: [address || '0x0000000000000000000000000000000000000000'],
    query: { enabled: !!address, refetchInterval: 5000 },
  });

  const { data: bal1, refetch: refetchBal1 } = useReadContract({
    address: TOKEN1_ADDRESS,
    abi: MockERC20Abi,
    functionName: 'balanceOf',
    args: [address || '0x0000000000000000000000000000000000000000'],
    query: { enabled: !!address, refetchInterval: 5000 },
  });

  // ─── Read Allowances ───────────────────────────────────────────────────
  const { data: allowance0, refetch: refetchAllow0 } = useReadContract({
    address: TOKEN0_ADDRESS,
    abi: MockERC20Abi,
    functionName: 'allowance',
    args: [address || '0x0000000000000000000000000000000000000000', SWAP_ROUTER_ADDRESS],
    query: { enabled: !!address },
  });

  const { data: allowance1, refetch: refetchAllow1 } = useReadContract({
    address: TOKEN1_ADDRESS,
    abi: MockERC20Abi,
    functionName: 'allowance',
    args: [address || '0x0000000000000000000000000000000000000000', SWAP_ROUTER_ADDRESS],
    query: { enabled: !!address },
  });

  // ─── Contract Writes ────────────────────────────────────────────────────
  const { writeContractAsync, isPending: isWriting } = useWriteContract();

  // ─── Calculate Fee Preview from On-Chain State ───────────────────────────
  const curBlockDebt = onChainFlowState
    ? Number(onChainFlowState.blockDebt ?? onChainFlowState[0] ?? 0)
    : 0;
  const curMatureDebt = onChainFlowState
    ? Number(onChainFlowState.matureDebt ?? onChainFlowState[1] ?? 0)
    : 0;
  const curVolEma = onChainFlowState
    ? Number(onChainFlowState.volatilityEma ?? onChainFlowState[2] ?? 0)
    : 0;

  const basePips = Number(baseFee || 500);
  const volPips = Math.round(curVolEma * Number(volRate || 6));
  let flowPips = 0;
  let discountPips = 0;
  let activeMode = 'Calm';

  const dirSign = direction ? -1 : 1;
  if (curBlockDebt !== 0) {
    const isSameSign = (curBlockDebt > 0 && dirSign > 0) || (curBlockDebt < 0 && dirSign < 0);
    const absDebt = Math.abs(curBlockDebt);
    if (isSameSign) {
      activeMode = 'Congestion';
      flowPips = absDebt * Number(congestionRate || 8);
    } else {
      activeMode = 'Reversal';
      flowPips = absDebt * Number(reversalRate || 15);
    }
  } else if (curMatureDebt !== 0) {
    const isCounter = (curMatureDebt > 0 && dirSign < 0) || (curMatureDebt < 0 && dirSign > 0);
    if (isCounter) {
      activeMode = 'Counterflow';
      discountPips = Math.min(Math.abs(curMatureDebt) * Number(counterflowRate || 3), basePips - Number(minFee || 100));
    } else {
      activeMode = 'MatureRisk';
      flowPips = Math.abs(curMatureDebt) * Number(congestionRate || 8);
    }
  }

  const grossFee = basePips + volPips + flowPips;
  const netFee = Math.max(Number(minFee || 100), Math.min(Number(maxFee || 10000), grossFee - discountPips));
  const finalBps = (netFee / 100).toFixed(2);

  // ─── Network Validation Helper ───────────────────────────────────────────
  async function ensureBaseSepolia() {
    if (chain?.id !== baseSepolia.id) {
      setStatusMsg('Switching network to Base Sepolia in MetaMask...');
      await switchChainAsync({ chainId: baseSepolia.id });
    }
  }

  // ─── Actions ─────────────────────────────────────────────────────────────
  // 1. Faucet
  async function handleFaucet() {
    if (!address) return alert('Please connect your wallet first!');
    try {
      await ensureBaseSepolia();
      setStatusMsg('Minting 1,000 fUSD (Step 1/2)... Please confirm in MetaMask.');
      const tx1 = await writeContractAsync({
        address: TOKEN0_ADDRESS,
        abi: MockERC20Abi,
        functionName: 'mint',
        args: [address, parseEther('1000')],
      });
      setStatusMsg('Minting 1,000 fETH (Step 2/2)... Please confirm in MetaMask.');
      const tx2 = await writeContractAsync({
        address: TOKEN1_ADDRESS,
        abi: MockERC20Abi,
        functionName: 'mint',
        args: [address, parseEther('1000')],
      });
      setLastTxHash(tx2);
      setStatusMsg('✅ Successfully minted 1,000 fUSD and 1,000 fETH!');
      refetchBal0();
      refetchBal1();
    } catch (err) {
      console.error(err);
      setStatusMsg(`❌ Faucet error: ${err.shortMessage || err.message}`);
    }
  }

  // 2. Execute Swap
  async function handleSwap(forcedDir = direction, customAmount = swapAmount) {
    if (!address) return alert('Please connect your wallet first!');
    try {
      await ensureBaseSepolia();
      const amtWei = parseEther(customAmount.toString());
      const tokenIn = forcedDir ? TOKEN0_ADDRESS : TOKEN1_ADDRESS;
      // Check live allowance directly from chain
      let curAllowance = 0n;
      if (publicClient) {
        try {
          curAllowance = await publicClient.readContract({
            address: tokenIn,
            abi: MockERC20Abi,
            functionName: 'allowance',
            args: [address, SWAP_ROUTER_ADDRESS],
          });
        } catch (e) {
          curAllowance = (forcedDir ? allowance0 : allowance1) ?? 0n;
        }
      } else {
        curAllowance = (forcedDir ? allowance0 : allowance1) ?? 0n;
      }

      if (curAllowance < amtWei) {
        setStatusMsg(`Approving ${forcedDir ? 'fUSD' : 'fETH'} for SwapRouter... Please confirm in MetaMask.`);
        const approveTx = await writeContractAsync({
          address: tokenIn,
          abi: MockERC20Abi,
          functionName: 'approve',
          args: [SWAP_ROUTER_ADDRESS, parseEther('1000000')],
        });
        setStatusMsg(`Approval sent (${approveTx.slice(0, 10)}...)... Waiting for confirmation on Base Sepolia...`);
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: approveTx });
        }
        await Promise.all([refetchAllow0(), refetchAllow1()]);
        setStatusMsg(`Approval confirmed! Now submitting swap in MetaMask...`);
      }

      setStatusMsg(`Submitting swap on Base Sepolia... Please confirm in MetaMask.`);
      // zeroForOne buy: must be > MIN_SQRT_PRICE (4295128739), so use MIN+1
      // oneForZero sell: must be < MAX_SQRT_PRICE (1461446703485210103287273052203988822378723970342), so use MAX-1
      const sqrtLimit = forcedDir ? 4295128740n : 1461446703485210103287273052203988822378723970341n;

      const tx = await writeContractAsync({
        address: SWAP_ROUTER_ADDRESS,
        abi: PoolSwapTestAbi,
        functionName: 'swap',
        args: [
          POOL_KEY,
          {
            zeroForOne: forcedDir,
            amountSpecified: -amtWei,
            sqrtPriceLimitX96: sqrtLimit,
          },
          { takeClaims: false, settleUsingBurn: false },
          '0x',
        ],
      });

      setLastTxHash(tx);
      setStatusMsg(`Swap broadcasted (${tx.slice(0, 10)}...)... Waiting for block confirmation...`);

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: tx });
      }

      setStatusMsg(`🚀 Swap mined on Base Sepolia! Hash: ${tx.slice(0, 10)}...`);

      // Refetch balances and flow state
      refetchBal0();
      refetchBal1();
      refetchFlowState();

      if (onSwapExecuted) {
        onSwapExecuted({
          id: Date.now(),
          block: blockNumber ? Number(blockNumber) : 1,
          direction: forcedDir ? 'buy' : 'sell',
          amount: parseFloat(customAmount),
          token: forcedDir ? 'fUSD' : 'fETH',
          feeBps: parseFloat(finalBps),
          vanillaFeeBps: 5.0,
          deltaBps: parseFloat((parseFloat(finalBps) - 5.0).toFixed(2)),
          mode: activeMode,
          txHash: tx,
          onChain: true,
          components: {
            base: basePips / 100,
            volatility: volPips / 100,
            flow: flowPips / 100,
            counterflow: discountPips / 100,
          },
        });
      }
    } catch (err) {
      console.error(err);
      setStatusMsg(`❌ Swap failed: ${err.shortMessage || err.message}`);
    }
  }

  // 3. Attack Trigger: Same-Block Congestion Burst
  async function handleCongestionBurst() {
    setIsAttacking(true);
    setStatusMsg('Executing Same-Block Congestion Burst: Sending Swap 1...');
    try {
      await handleSwap(true, '5');
      setStatusMsg('Sending Swap 2 in rapid succession to ramp up Block Debt...');
      await handleSwap(true, '10');
      setStatusMsg('✅ Congestion Burst complete! On-chain Block Debt increased.');
    } catch (err) {
      setStatusMsg(`Burst error: ${err.shortMessage || err.message}`);
    } finally {
      setIsAttacking(false);
    }
  }

  // 4. Attack Trigger: Same-Block Sandwich Reversal
  async function handleSandwichReversal() {
    setIsAttacking(true);
    setStatusMsg('Executing Sandwich Reversal (Leg 1): Front-run Buy (fUSD)...');
    try {
      await handleSwap(true, '15');
      setStatusMsg('Executing Sandwich Reversal (Leg 2): Sell (fETH)... (Note: if next block, earns Counterflow discount; if same block, pays Reversal premium)');
      await handleSwap(false, '15');
      setStatusMsg('✅ Sandwich sequence completed! Check on-chain feed for the resulting fee mode.');
    } catch (err) {
      setStatusMsg(`Reversal error: ${err.shortMessage || err.message}`);
    } finally {
      setIsAttacking(false);
    }
  }

  // 5. Restorative Counterflow Trade — direction driven by live on-chain debt
  async function handleCounterflowTrade() {
    setIsAttacking(true);
    try {
      // Read freshest blockDebt directly from chain
      let freshDebt = curBlockDebt;
      if (publicClient) {
        try {
          const liveState = await publicClient.readContract({
            address: FAIRFLOW_ADDRESS,
            abi: FairFlowAbi,
            functionName: 'getFlowState',
            args: [POOL_ID],
          });
          freshDebt = Number(liveState.blockDebt ?? liveState[0] ?? curBlockDebt);
        } catch (e) {
          freshDebt = curBlockDebt;
        }
      }

      // If debt is negative (buy pressure), send a sell to counteract it.
      // If debt is positive (sell pressure), send a buy to counteract it.
      // If debt is zero, just use opposite of current UI direction.
      const counterDir = freshDebt !== 0 ? (freshDebt < 0 ? false : true) : !direction;
      const debtLabel = freshDebt < 0 ? `buy-heavy (${freshDebt} ticks)` : freshDebt > 0 ? `sell-heavy (+${freshDebt} ticks)` : 'neutral';
      const tradeLabel = counterDir ? 'Sell (fETH→fUSD)' : 'Buy (fUSD→fETH)';

      setStatusMsg(`Pool debt is ${debtLabel}. Sending opposing ${tradeLabel} to earn Counterflow Discount...`);
      await handleSwap(counterDir, '10');
      setStatusMsg('✅ Counterflow trade complete! Check the discount in the fee breakdown.');
    } catch (err) {
      setStatusMsg(`Counterflow error: ${err.shortMessage || err.message}`);
    } finally {
      setIsAttacking(false);
    }
  }

  const fUsdBal = bal0 ? parseFloat(formatEther(bal0)).toFixed(2) : '0.00';
  const fEthBal = bal1 ? parseFloat(formatEther(bal1)).toFixed(2) : '0.00';

  return (
    <div className="glass-card panel-full" style={{ marginBottom: '20px' }}>
      {/* Header */}
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            width: '10px', height: '10px', borderRadius: '50%',
            background: '#22c55e', boxShadow: '0 0 10px #22c55e',
          }} />
          <h3>🌐 Live Base Sepolia Testnet Contract &amp; Swapper</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
            Block #{blockNumber ? blockNumber.toString() : 'Syncing...'}
          </span>
          <a
            href={`https://sepolia.basescan.org/address/${FAIRFLOW_ADDRESS}`}
            target="_blank"
            rel="noreferrer"
            className="toolbar-btn"
            style={{ padding: '4px 10px', fontSize: '0.72rem', textDecoration: 'none' }}
          >
            ↗ Basescan Hook
          </a>
        </div>
      </div>

      <div className="card-body">
        {/* Wrong Network Alert Banner */}
        {isConnected && !isBaseSepolia && (
          <div style={{
            padding: '12px 18px',
            background: 'rgba(239, 68, 68, 0.18)',
            border: '1px solid rgba(239, 68, 68, 0.5)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.2rem' }}>⚠️</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#fca5a5' }}>
                  Wrong Network: Connected to {chain?.name || 'Ethereum Mainnet'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  FairFlow contracts and liquidity are deployed on Base Sepolia. Please switch networks in MetaMask to confirm transactions.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => switchChainAsync({ chainId: baseSepolia.id })}
              className="toolbar-btn"
              style={{
                background: '#ef4444',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.78rem',
                padding: '8px 16px',
                border: 'none',
              }}
            >
              Switch to Base Sepolia Now
            </button>
          </div>
        )}

        {/* On-Chain Verified Deployment Summary */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px',
          marginBottom: '20px',
        }}>
          <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '3px' }}>
              Hook Contract (CREATE2 0x10C0)
            </div>
            <div className="mono" style={{ fontSize: '0.78rem', color: 'var(--accent-pink)', wordBreak: 'break-all' }}>
              {FAIRFLOW_ADDRESS}
            </div>
          </div>

          <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '3px' }}>
              Uniswap v4 Pool (fUSD / fETH)
            </div>
            <div className="mono" style={{ fontSize: '0.78rem', color: 'var(--accent-purple)', wordBreak: 'break-all' }}>
              {POOL_ID.slice(0, 16)}...{POOL_ID.slice(-8)}
            </div>
          </div>

          <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--bg-glass-border)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '3px' }}>
              V4 SwapRouter (Canonical Test Router)
            </div>
            <div className="mono" style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)', wordBreak: 'break-all' }}>
              {SWAP_ROUTER_ADDRESS}
            </div>
          </div>
        </div>

        {/* Live On-Chain Flow State Gauges (Read from Contract) */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.25)',
          border: '1px solid var(--bg-glass-border)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 18px',
          marginBottom: '20px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
              ⚡ Live On-Chain State for Pool (<code style={{ color: 'var(--accent-pink)' }}>{POOL_ID.slice(0, 10)}...</code>)
            </span>
            <button
              onClick={() => refetchFlowState()}
              className="toolbar-btn"
              style={{ fontSize: '0.7rem', padding: '2px 8px' }}
            >
              ↻ Refresh State
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>BLOCK DEBT</div>
              <div className="mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: curBlockDebt !== 0 ? 'var(--accent-pink)' : 'var(--text-primary)' }}>
                {curBlockDebt > 0 ? `+${curBlockDebt}` : curBlockDebt} <span style={{ fontSize: '0.7rem' }}>ticks</span>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>MATURE DEBT</div>
              <div className="mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: curMatureDebt !== 0 ? 'var(--accent-orange)' : 'var(--text-primary)' }}>
                {curMatureDebt > 0 ? `+${curMatureDebt}` : curMatureDebt} <span style={{ fontSize: '0.7rem' }}>ticks</span>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>VOLATILITY EMA</div>
              <div className="mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: curVolEma > 0 ? 'var(--accent-purple)' : 'var(--text-primary)' }}>
                {curVolEma} <span style={{ fontSize: '0.7rem' }}>ticks</span>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>CURRENT FEE</div>
              <div className="mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-green)' }}>
                {finalBps} <span style={{ fontSize: '0.7rem' }}>bp</span>
              </div>
            </div>
          </div>
        </div>

        {/* User Balance & Faucet Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '12px 18px',
          background: 'rgba(59, 130, 246, 0.05)',
          border: '1px solid rgba(59, 130, 246, 0.15)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Your Testnet Balances:</span>
            <span className="mono" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-cyan)' }}>
              {fUsdBal} fUSD
            </span>
            <span className="mono" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-purple)' }}>
              {fEthBal} fETH
            </span>
          </div>

          <button
            onClick={() => (!isBaseSepolia ? switchChainAsync({ chainId: baseSepolia.id }) : handleFaucet())}
            disabled={!isConnected || isWriting}
            className="toolbar-btn primary"
            style={{ fontSize: '0.75rem', padding: '6px 14px' }}
          >
            {!isConnected
              ? '🚰 Connect Wallet'
              : !isBaseSepolia
              ? '⚠️ Switch to Base Sepolia'
              : isWriting
              ? 'Minting in MetaMask...'
              : '🚰 Faucet: Mint 1,000 fUSD & fETH'}
          </button>
        </div>

        {/* Live Swap & Attack Console */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '16px',
        }}>
          {/* Swapper Form */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--bg-glass-border)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
          }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>⚡ Execute Real On-Chain Swap</span>
              <FeeBadge mode={activeMode} />
            </div>

            {/* Direction Selector */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: '6px' }}>
                SWAP PAIR &amp; DIRECTION
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className={`toolbar-btn ${direction ? 'primary' : ''}`}
                  onClick={() => setDirection(true)}
                  style={{ flex: 1, fontSize: '0.75rem', padding: '7px' }}
                >
                  ↓ fUSD → fETH (Buy)
                </button>
                <button
                  type="button"
                  className={`toolbar-btn ${!direction ? 'primary' : ''}`}
                  onClick={() => setDirection(false)}
                  style={{ flex: 1, fontSize: '0.75rem', padding: '7px' }}
                >
                  ↑ fETH → fUSD (Sell)
                </button>
              </div>
            </div>

            {/* Amount */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: '6px' }}>
                AMOUNT TO SWAP
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="number"
                  value={swapAmount}
                  onChange={(e) => setSwapAmount(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--bg-glass-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 12px',
                    color: '#fff',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.85rem',
                  }}
                />
                <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {direction ? 'fUSD' : 'fETH'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                {['1', '5', '20', '100'].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    className="toolbar-btn"
                    onClick={() => setSwapAmount(amt)}
                    style={{ fontSize: '0.68rem', padding: '2px 8px' }}
                  >
                    {amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic Fee Quote Breakdown */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.2)',
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '16px',
              fontSize: '0.75rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-tertiary)' }}>Base Baseline Fee:</span>
                <span className="mono">{(basePips / 100).toFixed(2)} bp</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-tertiary)' }}>Flow Adjustment:</span>
                <span className="mono" style={{ color: flowPips > 0 ? 'var(--accent-pink)' : discountPips > 0 ? 'var(--accent-green)' : 'inherit' }}>
                  {flowPips > 0 ? `+${(flowPips / 100).toFixed(2)} bp (${activeMode})` : discountPips > 0 ? `-${(discountPips / 100).toFixed(2)} bp (Discount)` : '0.00 bp'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '6px', marginTop: '4px', fontWeight: 700 }}>
                <span>Total Dynamic Fee Charged:</span>
                <span className="mono" style={{ color: 'var(--accent-pink)', fontSize: '0.85rem' }}>{finalBps} bp</span>
              </div>
            </div>

            {/* Swap Button */}
            <button
              onClick={() => (!isBaseSepolia ? switchChainAsync({ chainId: baseSepolia.id }) : handleSwap())}
              disabled={!isConnected || isWriting}
              className="toolbar-btn primary"
              style={{ width: '100%', padding: '10px', fontSize: '0.85rem', fontWeight: 700 }}
            >
              {isWriting
                ? 'Mining on Base Sepolia...'
                : !isConnected
                ? 'Connect Wallet to Swap'
                : !isBaseSepolia
                ? '⚠️ Switch to Base Sepolia to Swap'
                : '⚡ Sign & Execute Swap'}
            </button>
          </div>

          {/* Interactive Attack & Flow Triggers */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--bg-glass-border)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                🎯 One-Click On-Chain Attack &amp; Flow Tests
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: '14px' }}>
                Test FairFlow's dynamic protections live on Base Sepolia. Each button signs and broadcasts real transactions!
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Congestion */}
                <button
                  onClick={handleCongestionBurst}
                  disabled={!isConnected || isWriting || isAttacking}
                  className="attack-card-btn"
                  style={{
                    background: 'rgba(244, 63, 94, 0.08)',
                    borderColor: 'rgba(244, 63, 94, 0.3)',
                  }}
                >
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-pink)', marginBottom: '3px' }}>
                    📈 Send Congestion Burst (2 Buys)
                  </div>
                  <div style={{ fontSize: '0.70rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    Sends rapid directional buys to increase signed blockDebt and hike the dynamic fee.
                  </div>
                </button>

                {/* Sandwich Reversal */}
                <button
                  onClick={handleSandwichReversal}
                  disabled={!isConnected || isWriting || isAttacking}
                  className="attack-card-btn"
                  style={{
                    background: 'rgba(234, 179, 8, 0.08)',
                    borderColor: 'rgba(234, 179, 8, 0.3)',
                  }}
                >
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-orange)', marginBottom: '3px' }}>
                    🥪 Send Sandwich Reversal (Buy then Sell)
                  </div>
                  <div style={{ fontSize: '0.70rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    Executes front-run then back-run. Designed to trigger the 15 pips/tick Reversal Premium against toxic same-block reversals.
                  </div>
                  <div style={{
                    marginTop: '6px',
                    padding: '5px 8px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(234, 179, 8, 0.12)',
                    fontSize: '0.67rem',
                    color: 'var(--accent-orange)',
                    lineHeight: 1.35,
                    borderLeft: '2px solid var(--accent-orange)',
                  }}>
                    ⚠️ <strong>Testnet Note:</strong> MetaMask signs each swap in separate blocks (~2s block time). When the sell lands in a later block, FairFlow rewards it as <strong>Counterflow</strong> (fee discount, e.g. 4.61 bp) rather than same-block Reversal (which requires an atomic bundle script).
                  </div>
                </button>

                {/* Counterflow */}
                <button
                  onClick={handleCounterflowTrade}
                  disabled={!isConnected || isWriting || isAttacking}
                  className="attack-card-btn"
                  style={{
                    background: 'rgba(34, 197, 94, 0.08)',
                    borderColor: 'rgba(34, 197, 94, 0.3)',
                  }}
                >
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-green)', marginBottom: '3px' }}>
                    💚 Send Restorative Counterflow Trade
                  </div>
                  <div style={{ fontSize: '0.70rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    Executes an opposing swap to reduce accumulated debt and earn the Counterflow fee discount!
                  </div>
                </button>
              </div>
            </div>

            {/* Status & Tx feedback */}
            {statusMsg && (
              <div style={{
                marginTop: '14px',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid var(--bg-glass-border)',
                fontSize: '0.75rem',
                wordBreak: 'break-all',
              }}>
                <div>{statusMsg}</div>
                {lastTxHash && (
                  <a
                    href={`https://sepolia.basescan.org/tx/${lastTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--accent-pink)', marginTop: '4px', display: 'inline-block', textDecoration: 'underline' }}
                  >
                    View on Basescan ↗
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
