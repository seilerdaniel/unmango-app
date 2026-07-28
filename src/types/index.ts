export interface Category {
  id: string
  user_id: string
  name: string
  color?: string
}

export interface Transaction {
  id?: string
  user_id?: string
  title: string
  amount_ars: number
  currency?: 'ARS' | 'USD'
  type: 'income' | 'expense'
  category_id?: string
  notes?: string
  created_at?: string
  categories?: {
    name: string
    color: string
  }
}

export interface Budget {
  id?: string
  user_id?: string
  category_id: string
  monthly_limit: number
  created_at?: string
  categories?: {
    name: string
    color: string
  }
}

export interface RecurringExpense {
  id?: string
  user_id?: string
  category_id?: string
  title: string
  amount: number
  currency: 'ARS' | 'USD'
  billing_day: number
  is_active: boolean
  created_at?: string
  categories?: {
    name: string
    color: string
  }
}