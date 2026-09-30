import { createContext, useContext } from 'react'

// exchangeRates: { EUR: 1.0, USD: 0.92, GBP: 1.17, ... } — EUR por 1 unidade da moeda
// null enquanto não forem carregadas (usa rateToEUR armazenado nos dados)
// history: [{ id, timestamp, label, data }] — snapshots desta sessão (max 50)
export const AppContext = createContext(null)
export const useApp = () => useContext(AppContext)
