import './globals.css';
import Web3Providers from '@/components/Web3Providers';

export const metadata = {
  title: 'FairFlow Dashboard — Two-Speed Flow-Debt Pricing for Uniswap v4',
  description: 'Interactive demo of FairFlow, an oracle-free dynamic LP fee hook that prices pool-level flow externalities. See live swaps, fee classification, flow debt visualization, and vanilla-vs-FairFlow comparisons.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0a0b0f" />
      </head>
      <body>
        <Web3Providers>
          {children}
        </Web3Providers>
      </body>
    </html>
  );
}
