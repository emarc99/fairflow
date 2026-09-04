import { http, createConfig } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';
import FairFlowAbi from './FairFlowAbi.json';
import PoolSwapTestAbi from './PoolSwapTestAbi.json';
import MockERC20Abi from './MockERC20Abi.json';

export const FAIRFLOW_ADDRESS = '0x984439E305dD17e7a16f2aAf876d99d9D7C710c0';
export const POOL_MANAGER_ADDRESS = '0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408';
export const SWAP_ROUTER_ADDRESS = '0xc19922f7F21d96472FDee81d67636293c4c05Eee';
export const LP_ROUTER_ADDRESS = '0xa2a06b311C40b4383a5265Bd1340484E53bD9ac6';
export const TOKEN0_ADDRESS = '0x3953E210A6F81BBe5d9cAA0BD2Cc89dED255f95E';
export const TOKEN1_ADDRESS = '0x9693aAd2540D75057D0CDce4c16891230D335A6B';
export const POOL_ID = '0xbba6de280d0e89c085a89e01d0782dd155c2efca422a005af78e54b3f877af6e';
export const DEPLOYMENT_TX = '0xca11ed4c73d748fe13c2a118f7d1a0da90d9b842c26373ac18591879d106670e';
export const POOL_INIT_TX = '0x233e42372e39035a60a2133d00e797b0c1a047b5d9dad07e7d11b9a16a17d548';
export const FIRST_SWAP_TX = '0x2b77f7fe2fa52bd300fd82412da6c05cc89f127429f890a17577b94bd6afb503';
export const BASE_SEPOLIA_CHAIN_ID = 84532;

export const POOL_KEY = {
  currency0: TOKEN0_ADDRESS,
  currency1: TOKEN1_ADDRESS,
  fee: 8388608, // 0x800000 = DYNAMIC_FEE_FLAG
  tickSpacing: 60,
  hooks: FAIRFLOW_ADDRESS,
};

export { FairFlowAbi, PoolSwapTestAbi, MockERC20Abi };

export const config = createConfig({
  chains: [baseSepolia],
  connectors: [injected()],
  transports: {
    [baseSepolia.id]: http('https://sepolia.base.org'),
  },
  ssr: true,
});
