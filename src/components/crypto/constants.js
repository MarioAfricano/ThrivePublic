// ── Constantes partilhadas da página Crypto ──────────────────────

// Estilos base para inputs e botões dentro dos modais/editors.
export const S = {
  input: {
    width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: 8, color: 'var(--text)', padding: '8px 10px', fontSize: '0.85rem',
    outline: 'none', boxSizing: 'border-box',
  },
  btnCancel: {
    background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
    color: 'var(--text-secondary)', padding: '8px 16px', cursor: 'pointer', fontSize: '0.85rem',
  },
  btnPrimary: {
    background: '#f59e0b', border: '1px solid #f59e0b', borderRadius: 8,
    color: '#000', padding: '8px 16px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700,
  },
  btnDisabled: {
    background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
    color: 'var(--text-muted)', padding: '8px 16px', cursor: 'default', fontSize: '0.85rem',
  },
}

// Mapeamento local ticker → id CoinGecko. Usado no AddHoldingModal para
// auto-preencher o preço. Subset do COINGECKO_IDS em App.jsx — manter
// sincronizado se houver adições frequentes.
export const GECKO_IDS = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', XRP: 'ripple', BNB: 'binancecoin',
  ADA: 'cardano', DOGE: 'dogecoin', DOT: 'polkadot', AVAX: 'avalanche-2', LINK: 'chainlink',
  UNI: 'uniswap', MATIC: 'matic-network', LTC: 'litecoin', BCH: 'bitcoin-cash', ATOM: 'cosmos',
  XLM: 'stellar', VET: 'vechain', FIL: 'filecoin', TRX: 'tron', ETC: 'ethereum-classic',
  NEAR: 'near', ALGO: 'algorand', SHIB: 'shiba-inu', TON: 'the-open-network',
  PEPE: 'pepe', WIF: 'dogwifcoin', BONK: 'bonk', ICP: 'internet-computer', APT: 'aptos',
}

// Plataformas sugeridas no AddPlatformModal.
export const PLATFORM_SUGGESTIONS = [
  'Binance', 'Coinbase', 'Kraken', 'Bitget', 'OKX', 'Bybit', 'Crypto.com', 'Revolut', 'eToro',
]

// Criptomoedas populares mostradas no AddHoldingModal como chips.
export const POPULAR_COINS = [
  { ticker: 'BTC',  name: 'Bitcoin' },
  { ticker: 'ETH',  name: 'Ethereum' },
  { ticker: 'SOL',  name: 'Solana' },
  { ticker: 'XRP',  name: 'XRP' },
  { ticker: 'BNB',  name: 'BNB' },
  { ticker: 'ADA',  name: 'Cardano' },
  { ticker: 'DOGE', name: 'Dogecoin' },
  { ticker: 'DOT',  name: 'Polkadot' },
]
