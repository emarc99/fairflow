'use client';

import { useAccount, useConnect, useDisconnect, useBalance, useSwitchChain } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';

export default function WalletButton() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { data: balance } = useBalance({ address });

  if (isConnected && address) {
    const isBaseSepolia = chain?.id === baseSepolia.id;
    const truncated = `${address.slice(0, 6)}...${address.slice(-4)}`;
    const formattedBal = balance ? `${parseFloat(balance.formatted).toFixed(3)} ${balance.symbol}` : '';

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {!isBaseSepolia && (
          <button
            className="toolbar-btn"
            onClick={() => switchChain({ chainId: baseSepolia.id })}
            style={{
              background: 'rgba(239, 68, 68, 0.25)',
              borderColor: 'rgba(239, 68, 68, 0.6)',
              color: '#fca5a5',
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '6px 12px',
              animation: 'pulse 2s infinite',
            }}
          >
            ⚠️ Switch to Base Sepolia
          </button>
        )}

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: 'var(--radius-md)',
          background: isBaseSepolia ? 'rgba(59, 130, 246, 0.12)' : 'rgba(239, 68, 68, 0.12)',
          border: `1px solid ${isBaseSepolia ? 'rgba(59, 130, 246, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          fontSize: '0.78rem',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: isBaseSepolia ? '#3b82f6' : '#ef4444',
            display: 'inline-block',
          }} />
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{truncated}</span>
          {formattedBal && (
            <span style={{ color: 'var(--text-secondary)', marginLeft: '4px' }}>
              ({formattedBal})
            </span>
          )}
        </div>
        <button
          className="toolbar-btn"
          onClick={() => disconnect()}
          title="Disconnect Wallet"
          style={{ padding: '6px 10px', fontSize: '0.75rem' }}
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      className="toolbar-btn primary"
      onClick={() => {
        const injectedConnector = connectors.find(c => c.id === 'injected') || connectors[0];
        if (injectedConnector) {
          connect({ connector: injectedConnector });
        }
      }}
      disabled={isPending}
      style={{ padding: '7px 14px', fontSize: '0.8rem', fontWeight: 600 }}
    >
      {isPending ? 'Connecting...' : '⚡ Connect Wallet'}
    </button>
  );
}
