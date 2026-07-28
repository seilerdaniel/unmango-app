export interface Category {
  id: string
  user_id: string
  name: string
  color?: string
}

export interface Transaction {
  id?: string
  user_id?: string
  category_id?: string | null
  description: string
  type: 'income' | 'expense'
  payment_method: string
  wallet_provider?: string | null
  operation_number?: string | null
  is_usd: boolean
  amount_usd?: number | null
  amount_ars: number
  exchange_rate?: number | null
  created_at?: string
  categories?: Category | null
}