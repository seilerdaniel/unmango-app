// Tipos de la base de datos de Supabase.
//
// IMPORTANTE: este archivo está escrito a mano en base a los tipos que ya
// existían en src/types/index.ts, porque no tenemos acceso al proyecto real
// de Supabase para generarlo automáticamente. En cuanto puedas, reemplazalo
// corriendo desde tu máquina (con la CLI de Supabase logueada):
//
//   npx supabase login
//   npx supabase gen types typescript --project-id <tu-project-id> > src/types/database.ts
//
// Eso te va a dar el schema 100% real (incluyendo columnas que quizás no
// están reflejadas acá, y las relaciones/foreign keys reales para que los
// joins tipo `categories(*)` tipen mejor). Mientras tanto, esta versión ya
// sirve para que TypeScript detecte en compilación errores como el que
// arreglamos en RecurringManager (insertar campos que no existen o que
// faltan campos requeridos).
//
// Las entradas en Functions de más abajo tienen que coincidir con las
// funciones creadas por supabase/functions.sql (get_transaction_totals,
// get_monthly_category_spend) y supabase/wallets.sql (get_wallet_balances).
// Si corrés `gen types`, ese comando ya las va a incluir automáticamente
// si corriste esos archivos antes.

export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string
          user_id: string
          name: string
          color: string | null
          budget_group: 'necesidad' | 'deseo' | 'ahorro' | null
          icon: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          color?: string | null
          budget_group?: 'necesidad' | 'deseo' | 'ahorro' | null
          icon?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          color?: string | null
          budget_group?: 'necesidad' | 'deseo' | 'ahorro' | null
          icon?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          category_id: string | null
          wallet_id: string | null
          description: string
          type: 'income' | 'expense'
          payment_method: string
          wallet_provider: string | null
          operation_number: string | null
          is_usd: boolean
          amount_usd: number | null
          amount_ars: number
          exchange_rate: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          category_id?: string | null
          wallet_id?: string | null
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
        }
        Update: {
          id?: string
          user_id?: string
          category_id?: string | null
          wallet_id?: string | null
          description?: string
          type?: 'income' | 'expense'
          payment_method?: string
          wallet_provider?: string | null
          operation_number?: string | null
          is_usd?: boolean
          amount_usd?: number | null
          amount_ars?: number
          exchange_rate?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          }
        ]
      }
      budgets: {
        Row: {
          id: string
          user_id: string
          category_id: string
          monthly_limit: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          category_id: string
          monthly_limit: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          category_id?: string
          monthly_limit?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            referencedRelation: "categories"
            referencedColumns: ["id"]
          }
        ]
      }
      recurring_expenses: {
        Row: {
          id: string
          user_id: string
          category_id: string | null
          title: string
          amount: number
          currency: 'ARS' | 'USD'
          billing_day: number
          is_active: boolean
          created_at: string
          payment_method: string | null
          membership_type: string | null
          tax_percentage: number
          wallet_id: string | null
        }
        Insert: {
          id?: string
          user_id: string
          category_id?: string | null
          title: string
          amount: number
          currency: 'ARS' | 'USD'
          billing_day: number
          is_active?: boolean
          created_at?: string
          payment_method?: string | null
          membership_type?: string | null
          tax_percentage?: number
          wallet_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          category_id?: string | null
          title?: string
          amount?: number
          currency?: 'ARS' | 'USD'
          billing_day?: number
          is_active?: boolean
          created_at?: string
          payment_method?: string | null
          membership_type?: string | null
          tax_percentage?: number
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_expenses_category_id_fkey"
            columns: ["category_id"]
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_expenses_wallet_id_fkey"
            columns: ["wallet_id"]
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          }
        ]
      }
      wallets: {
        Row: {
          id: string
          user_id: string
          name: string
          type: 'cash' | 'bank' | 'virtual_wallet' | 'credit_card' | 'debit_card' | 'other'
          color: string | null
          initial_balance: number
          created_at: string
          card_network: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          type?: 'cash' | 'bank' | 'virtual_wallet' | 'credit_card' | 'debit_card' | 'other'
          color?: string | null
          initial_balance?: number
          created_at?: string
          card_network?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          type?: 'cash' | 'bank' | 'virtual_wallet' | 'credit_card' | 'debit_card' | 'other'
          color?: string | null
          initial_balance?: number
          created_at?: string
          card_network?: string | null
        }
        Relationships: []
      }
      savings_goals: {
        Row: {
          id: string
          user_id: string
          name: string
          target_amount: number
          current_amount: number
          monthly_contribution: number
          monthly_interest_rate: number
          color: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          target_amount: number
          current_amount?: number
          monthly_contribution?: number
          monthly_interest_rate?: number
          color?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          target_amount?: number
          current_amount?: number
          monthly_contribution?: number
          monthly_interest_rate?: number
          color?: string | null
          created_at?: string
        }
        Relationships: []
      }
      installment_purchases: {
        Row: {
          id: string
          user_id: string
          category_id: string | null
          description: string
          total_amount: number
          installments_count: number
          first_installment_date: string
          created_at: string
          payment_method: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          user_id: string
          category_id?: string | null
          description: string
          total_amount: number
          installments_count: number
          first_installment_date?: string
          created_at?: string
          payment_method?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          category_id?: string | null
          description?: string
          total_amount?: number
          installments_count?: number
          first_installment_date?: string
          created_at?: string
          payment_method?: string | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "installment_purchases_category_id_fkey"
            columns: ["category_id"]
            referencedRelation: "categories"
            referencedColumns: ["id"]
          }
        ]
      }
      installment_payments: {
        Row: {
          id: string
          installment_purchase_id: string
          user_id: string
          installment_number: number
          transaction_id: string | null
          paid_at: string
        }
        Insert: {
          id?: string
          installment_purchase_id: string
          user_id: string
          installment_number: number
          transaction_id?: string | null
          paid_at?: string
        }
        Update: {
          id?: string
          installment_purchase_id?: string
          user_id?: string
          installment_number?: number
          transaction_id?: string | null
          paid_at?: string
        }
        Relationships: []
      }
      net_worth_snapshots: {
        Row: {
          id: string
          user_id: string
          snapshot_date: string
          total_balance_ars: number
          usd_blue_rate: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          snapshot_date?: string
          total_balance_ars: number
          usd_blue_rate: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          snapshot_date?: string
          total_balance_ars?: number
          usd_blue_rate?: number
          created_at?: string
        }
        Relationships: []
      }
      telegram_links: {
        Row: {
          id: string
          user_id: string
          linking_code: string
          telegram_chat_id: number | null
          created_at: string
          linked_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          linking_code: string
          telegram_chat_id?: number | null
          created_at?: string
          linked_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          linking_code?: string
          telegram_chat_id?: number | null
          created_at?: string
          linked_at?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      get_transaction_totals: {
        Args: Record<string, never>
        Returns: { total_income: number; total_expense: number }[]
      }
      get_monthly_category_spend: {
        Args: { p_year: number; p_month: number }
        Returns: { category_id: string; spent: number }[]
      }
      get_wallet_balances: {
        Args: Record<string, never>
        Returns: { wallet_id: string; balance: number }[]
      }
      get_monthly_trend: {
        Args: { p_months: number }
        Returns: { month_start: string; total_income: number; total_expense: number }[]
      }
      get_recurring_price_changes: {
        Args: Record<string, never>
        Returns: {
          recurring_expense_id: string
          current_amount: number
          previous_amount: number | null
          currency: string
        }[]
      }
    }
  }
}
