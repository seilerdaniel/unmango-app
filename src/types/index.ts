import { Database } from './database'

// Estos tipos derivan de src/types/database.ts (el schema real de Supabase)
// en vez de duplicarse a mano, para que un cambio de columna en la base se
// note acá con un error de compilación en vez de un bug silencioso en
// runtime (ver AUDIT.md, Fase 3).

export type Category = Database['public']['Tables']['categories']['Row']

export type Transaction = Database['public']['Tables']['transactions']['Row'] & {
  categories?: Category | null
}

export type Budget = Database['public']['Tables']['budgets']['Row'] & {
  categories?: {
    name: string
    color: string | null
  } | null
}

export type RecurringExpense = Database['public']['Tables']['recurring_expenses']['Row'] & {
  categories?: {
    name: string
    color: string | null
  } | null
}

export type Wallet = Database['public']['Tables']['wallets']['Row']

export type WalletWithBalance = Wallet & {
  balance: number
}

export type SavingsGoal = Database['public']['Tables']['savings_goals']['Row']

export type InstallmentPurchase = Database['public']['Tables']['installment_purchases']['Row'] & {
  categories?: { name: string; color: string | null } | null
}

export type InstallmentPayment = Database['public']['Tables']['installment_payments']['Row']
