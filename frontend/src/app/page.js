'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  DEFAULTS,
  createFlowState,
  simulateSwap,
  vanillaFee,
  cloneState,
} from '@/lib/fairflow-engine';
import { scenarios, getScenario } from '@/lib/scenarios';

import ScenarioToolbar from '@/components/ScenarioToolbar';
import SwapFeed from '@/components/SwapFeed';
import FeeClassification from '@/components/FeeClassification';
import FlowDebtGauge from '@/components/FlowDebtGauge';
import LPValueCapture from '@/components/LPValueCapture';
import Comparison from '@/components/Comparison';
import TransactionExplainer from '@/components/TransactionExplainer';
import ParameterDrawer from '@/components/ParameterDrawer';
import HowItWorksModal from '@/components/HowItWorksModal';
import WalletButton from '@/components/WalletButton';
import OnChainLivePanel from '@/components/OnChainLivePanel';

import { usePublicClient } from 'wagmi';
import { parseAbiItem, formatEther } from 'viem';
import { POOL_MANAGER_ADDRESS, POOL_ID } from '@/lib/web3Config';

export default function DashboardPage() {
  const publicClient = usePublicClient();

  // ─── Mode State (Simulation vs On-Chain) ─────────────────────────────────
  const [activeTab, setActiveTab] = useState('onchain');

  // ─── Scenario State ─────────────────────────────────────────────────────
  const [scenarioId, setScenarioId] = useState(scenarios[0].id);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [currentBlock, setCurrentBlock] = useState(1);
  const [stepIndex, setStepIndex] = useState(0);

  // ─── Simulation & On-Chain State ───────────────────────────────────────
  const [swaps, setSwaps] = useState([]);
  const [flowState, setFlowState] = useState(createFlowState());
  const [flowStateB, setFlowStateB] = useState(createFlowState()); // for multi-pool
  const [debtHistory, setDebtHistory] = useState([]);
  const [selectedSwapIdx, setSelectedSwapIdx] = useState(0);

  // Restore on-chain swaps from localStorage on load
  useEffect(() => {
    try {
      const saved = localStorage.getItem('fairflow_swaps_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSwaps(parsed);
        }
      }
    } catch (e) {}
  }, []);

  // Fetch real on-chain swap events directly from Base Sepolia
  useEffect(() => {
    async function fetchOnChainHistory() {
      if (!publicClient) return;
      try {
        const currentBlockNum = await publicClient.getBlockNumber();
        const fromBlock = currentBlockNum > 9000n ? currentBlockNum - 9000n : 0n;

        const logs = await publicClient.getLogs({
          address: POOL_MANAGER_ADDRESS,
          event: parseAbiItem('event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)'),
          args: { id: POOL_ID },
          fromBlock,
          toBlock: 'latest',
        });

        if (logs && logs.length > 0) {
          const parsedSwaps = logs.map((log, idx) => {
            const rawAmt0 = log.args.amount0 ?? 0n;
            const isZeroForOne = rawAmt0 < 0n;
            const absAmt0 = rawAmt0 < 0n ? -rawAmt0 : rawAmt0;
            const amount0 = Number(formatEther(absAmt0));
            const feePips = log.args.fee ? Number(log.args.fee) : 500;
            const feeBps = feePips / 100;
            const deltaBps = Number((feeBps - 5.0).toFixed(2));
            const mode = deltaBps > 0 ? (deltaBps >= 5.0 ? 'Reversal' : 'Congestion') : deltaBps < 0 ? 'Counterflow' : 'Calm';

            return {
              id: `onchain-${log.transactionHash}-${log.logIndex ?? idx}`,
              block: Number(log.blockNumber),
              direction: isZeroForOne ? 'buy' : 'sell',
              amount: parseFloat(amount0.toFixed(2)) || 1.0,
              token: isZeroForOne ? 'fUSD' : 'fETH',
              feeBps,
              vanillaFeeBps: 5.0,
              deltaBps,
              mode,
              txHash: log.transactionHash,
              onChain: true,
              components: {
                base: 5.0,
                volatility: 0,
                flow: Math.max(0, deltaBps),
                counterflow: Math.max(0, -deltaBps),
              },
              label: `On-Chain Swap ${amount0.toFixed(1)} ${isZeroForOne ? 'fUSD' : 'fETH'}`,
              explanation: `Live transaction pulled directly from Base Sepolia event logs (Block #${log.blockNumber}). Fee: ${feeBps.toFixed(2)} bp.`,
            };
          }).reverse();

          setSwaps(prev => {
            const existingHashes = new Set(parsedSwaps.map(s => s.txHash));
            const localOnly = prev.filter(s => !existingHashes.has(s.txHash));
            const combined = [...localOnly, ...parsedSwaps];
            try {
              localStorage.setItem('fairflow_swaps_v2', JSON.stringify(combined));
            } catch (e) {}
            return combined;
          });
        }
      } catch (err) {
        console.error('Failed to fetch on-chain history logs:', err);
      }
    }

    fetchOnChainHistory();
  }, [publicClient]);

  // Persist swaps to localStorage whenever updated
  useEffect(() => {
    try {
      if (swaps.length > 0) {
        localStorage.setItem('fairflow_swaps_v2', JSON.stringify(swaps));
      }
    } catch (e) {}
  }, [swaps]);

  const handleOnChainSwap = useCallback((newSwap) => {
    setSwaps(prev => {
      const updated = [newSwap, ...prev.filter(s => s.txHash !== newSwap.txHash)];
      try {
        localStorage.setItem('fairflow_swaps_v2', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
    setSelectedSwapIdx(0);
    setDebtHistory(prev => [
      ...prev.slice(-29),
      {
        block: newSwap.block,
        blockDebt: newSwap.direction === 'buy' ? -newSwap.amount : newSwap.amount,
        matureDebt: 0,
      },
    ]);
  }, []);

  // ─── Parameters ────────────────────────────────────────────────────────
  const [params, setParams] = useState({ ...DEFAULTS });
  const [showParams, setShowParams] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  // ─── Refs for interval ─────────────────────────────────────────────────
  const intervalRef = useRef(null);
  const stateRef = useRef(flowState);
  const stateBRef = useRef(flowStateB);
  const blockRef = useRef(currentBlock);
  const stepRef = useRef(stepIndex);
  const swapsRef = useRef(swaps);
  const debtHistoryRef = useRef(debtHistory);

  // Keep refs in sync
  useEffect(() => { stateRef.current = flowState; }, [flowState]);
  useEffect(() => { stateBRef.current = flowStateB; }, [flowStateB]);
  useEffect(() => { blockRef.current = currentBlock; }, [currentBlock]);
  useEffect(() => { stepRef.current = stepIndex; }, [stepIndex]);
  useEffect(() => { swapsRef.current = swaps; }, [swaps]);
  useEffect(() => { debtHistoryRef.current = debtHistory; }, [debtHistory]);

  // ─── Execute one swap step ────────────────────────────────────────────
  const executeStep = useCallback(() => {
    const scenario = getScenario(scenarioId);
    const idx = stepRef.current;

    if (idx >= scenario.steps.length) {
      setIsPlaying(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const step = scenario.steps[idx];
    let block = blockRef.current;
    if (step.newBlock) {
      block += 1;
      setCurrentBlock(block);
      blockRef.current = block;
    }

    // Determine which pool state to use
    const isPoolB = step.pool === 'B';
    const state = cloneState(isPoolB ? stateBRef.current : stateRef.current);

    const result = simulateSwap(state, block, step.zeroForOne, step.tickMovement, params);

    // Update correct pool state
    if (isPoolB) {
      setFlowStateB(state);
      stateBRef.current = state;
    } else {
      setFlowState(state);
      stateRef.current = state;
    }

    const swapRecord = {
      index: idx,
      label: step.label,
      zeroForOne: step.zeroForOne,
      tickMovement: step.tickMovement,
      block,
      pool: step.pool || 'A',
      description: step.description,
      fee: result.fee,
      vanillaFee: vanillaFee(params).finalFee,
      stateBefore: result.stateBefore,
      stateAfter: result.stateAfter,
    };

    const newSwaps = [...swapsRef.current, swapRecord];
    setSwaps(newSwaps);
    swapsRef.current = newSwaps;
    setSelectedSwapIdx(newSwaps.length - 1);

    // Update debt history (use primary pool)
    if (!isPoolB) {
      const newHistory = [...debtHistoryRef.current, {
        blockDebt: state.blockDebt,
        matureDebt: state.matureDebt,
        volatilityEma: state.volatilityEma,
      }];
      setDebtHistory(newHistory);
      debtHistoryRef.current = newHistory;
    }

    setStepIndex(idx + 1);
    stepRef.current = idx + 1;
  }, [scenarioId, params]);

  // ─── Play / Pause ─────────────────────────────────────────────────────
  useEffect(() => {
    if (isPlaying) {
      const delay = Math.max(200, 1200 / speed);
      intervalRef.current = setInterval(executeStep, delay);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, speed, executeStep]);

  // ─── Reset ────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setIsPlaying(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    const newState = createFlowState();
    setFlowState(newState);
    stateRef.current = newState;
    setFlowStateB(createFlowState());
    stateBRef.current = createFlowState();
    setCurrentBlock(1);
    blockRef.current = 1;
    setStepIndex(0);
    stepRef.current = 0;
    setSwaps([]);
    swapsRef.current = [];
    setDebtHistory([]);
    debtHistoryRef.current = [];
    setSelectedSwapIdx(null);
  }, []);

  // ─── Scenario change ─────────────────────────────────────────────────
  const handleScenarioChange = useCallback((id) => {
    setScenarioId(id);
    handleReset();
  }, [handleReset]);

  // ─── Parameter change ─────────────────────────────────────────────────
  const handleParamChange = useCallback((key, value) => {
    setParams(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleParamReset = useCallback(() => {
    setParams({ ...DEFAULTS });
  }, []);

  // ─── Current scenario info ────────────────────────────────────────────
  const scenario = getScenario(scenarioId);
  const selectedSwap = selectedSwapIdx !== null ? swaps[selectedSwapIdx] : null;
  const isComplete = stepIndex >= scenario.steps.length;

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="dashboard-title">
          <div>
            <h1>FairFlow</h1>
            <div className="subtitle">Two-Speed Flow-Debt Pricing for Uniswap v4 — Base Sepolia Testnet &amp; Attack Simulation</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <WalletButton />
          <button className="toolbar-btn" onClick={() => setShowHowItWorks(true)}>
            ? Mechanism Architecture
          </button>
        </div>
      </div>

      {/* Mode Switcher */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '12px',
        background: 'rgba(255, 255, 255, 0.02)',
        padding: '8px 12px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--bg-glass-border)',
      }}>
        <div style={{
          display: 'flex',
          gap: '6px',
        }}>
          <button
            className={`toolbar-btn ${activeTab === 'onchain' ? 'primary' : ''}`}
            onClick={() => setActiveTab('onchain')}
            style={{ padding: '8px 18px', fontSize: '0.82rem', fontWeight: 700 }}
          >
            🌐 Base Sepolia Live Contract
          </button>
          <button
            className={`toolbar-btn ${activeTab === 'simulation' ? 'primary' : ''}`}
            onClick={() => setActiveTab('simulation')}
            style={{ padding: '8px 18px', fontSize: '0.82rem', fontWeight: 700 }}
          >
            ⚡ 7 Interactive Attack/Flow Scenarios
          </button>
        </div>

        {activeTab === 'simulation' && (
          <ScenarioToolbar
            currentScenario={scenarioId}
            onScenarioChange={handleScenarioChange}
            isPlaying={isPlaying}
            onPlayPause={() => {
              if (isComplete) handleReset();
              setIsPlaying(prev => !prev);
            }}
            onReset={handleReset}
            speed={speed}
            onSpeedChange={setSpeed}
            currentBlock={currentBlock}
            onOpenParams={() => setShowParams(true)}
            onOpenHowItWorks={() => setShowHowItWorks(true)}
          />
        )}

        {activeTab === 'onchain' && (
          <button
            className="toolbar-btn primary"
            onClick={() => setActiveTab('simulation')}
            style={{ fontSize: '0.8rem', padding: '8px 16px' }}
          >
            ▶ Play Attack Scenarios (Live Feed) →
          </button>
        )}
      </div>

      {/* Live On-Chain Contract Panel */}
      {activeTab === 'onchain' && (
        <OnChainLivePanel onSwapExecuted={handleOnChainSwap} />
      )}

      {/* Scenario description (in Simulation tab) */}
      {activeTab === 'simulation' && (
        <div className="glass-card" style={{ marginBottom: '16px', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '1.5rem' }}>{scenario.icon}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{scenario.name}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{scenario.description}</div>
          </div>
          {isComplete && (
            <div style={{
              marginLeft: 'auto', padding: '4px 12px', borderRadius: 'var(--radius-full)',
              background: 'rgba(34,197,94,0.1)', color: 'var(--positive)',
              fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap',
            }}>
              ✓ Complete
            </div>
          )}
        </div>
      )}

      {/* Panel Grid */}
      <div className="dashboard-grid">
        {/* Full-width: Swap Feed */}
        <SwapFeed swaps={swaps} selectedIdx={selectedSwapIdx} onSelect={setSelectedSwapIdx} />

        {/* Row 2: Fee Classification + Flow Debt */}
        <FeeClassification swaps={swaps} />
        <FlowDebtGauge state={flowState} debtHistory={debtHistory} />

        {/* Row 3: LP Value + Comparison */}
        <LPValueCapture swaps={swaps} />
        <Comparison swaps={swaps} />

        {/* Full-width: Transaction Explainer */}
        <div className="panel-full">
          <TransactionExplainer swap={selectedSwap} />
        </div>
      </div>

      {/* Drawers / Modals */}
      {showParams && (
        <ParameterDrawer
          params={params}
          onChange={handleParamChange}
          onClose={() => setShowParams(false)}
          onReset={handleParamReset}
        />
      )}
      {showHowItWorks && (
        <HowItWorksModal onClose={() => setShowHowItWorks(false)} />
      )}
    </div>
  );
}
