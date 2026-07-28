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

export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string
          user_id: string
          name: string
          color: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          color?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          color?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          category_id: string | null
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
        }
        Relationships: [
          {
            foreignKeyName: "recurring_expenses_category_id_fkey"
            columns: ["category_id"]
            referencedRelation: "categories"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
