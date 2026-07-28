"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { Transaction } from "@/types";
import TransactionForm from "@/components/TransactionForm";
import CategoryManager from "@/components/CategoryManager";
import BudgetManager from "@/components/BudgetManager";
import FinanceChart from "@/components/FinanceChart";
import TrendChart from "@/components/TrendChart";
import TransactionFilters from "@/components/TransactionFilters";
import {
  LogOut,
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
  Eye,
  EyeOff,
  Sun,
  Moon,
} from "lucide-react";
import { usePrivacy } from "@/context/PrivacyContext";
import { useTheme } from "@/context/ThemeContext";
import RecurringManager from "@/components/RecurringManager";
import WalletManager from "@/components/WalletManager";
import SavingsGoals from "@/components/SavingsGoals";
import ImportTransactions from "@/components/ImportTransactions";
import ZeroSpendStreak from "@/components/ZeroSpendStreak";
import ArsUsdCalculator from "@/components/ArsUsdCalculator";
import BackupRestore from "@/components/BackupRestore";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

// Cantidad de movimientos que se traen por página. El balance y los totales
// NO dependen de este número: se calculan del lado del servidor con la
// función get_transaction_totals (ver supabase/functions.sql), así que
// paginar la lista visual no afecta la exactitud de esas cifras.
const PAGE_SIZE = 50;

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<
    Transaction[]
  >([]);
  const [totals, setTotals] = useState({ totalIncome: 0, totalExpense: 0 });
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Consumimos el contexto de privacidad y de tema
  const { isPrivate, togglePrivacy, formatAmount } = usePrivacy();
  const { theme, toggleTheme } = useTheme();

  // Atajos de teclado: N nueva transacción, P modo privado, / buscar.
  useKeyboardShortcuts({
    onNewTransaction: () => {
      document.getElementById("transaction-description-input")?.focus();
    },
    onTogglePrivacy: togglePrivacy,
    onFocusSearch: () => {
      document.getElementById("transaction-search-input")?.focus();
    },
  });

  // Totales de TODA la historia del usuario, calculados en Postgres para no
  // tener que traer todas las filas al cliente solo para sumarlas.
  async function fetchTotals() {
    const { data, error } = await supabase.rpc("get_transaction_totals");
    if (!error && data && data[0]) {
      setTotals({
        totalIncome: Number(data[0].total_income) || 0,
        totalExpense: Number(data[0].total_expense) || 0,
      });
    } else if (error) {
      console.error("Error calculando totales:", error);
    }
  }

  // Primera página del historial (la más reciente). Se llama al iniciar y
  // después de cualquier alta/baja de movimiento.
  async function fetchTransactions() {
    // Se pide el usuario actual en cada llamada (en vez de usar el estado
    // `user` del closure) para evitar traer datos antes de que la sesión
    // esté resuelta. El filtro por user_id es defensa en profundidad además
    // de las políticas RLS (ver supabase/rls_policies.sql).
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    if (!currentUser) return;

    const { data, error } = await supabase
      .from("transactions")
      .select("*, categories(*)")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false })
      .range(0, PAGE_SIZE - 1);

    if (!error && data) {
      setAllTransactions(data);
      setFilteredTransactions(data);
      setHasMore(data.length === PAGE_SIZE);
    }

    await fetchTotals();
  }

  // Trae la siguiente página y la agrega al final de lo ya cargado.
  async function loadMoreTransactions() {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    if (!currentUser) return;

    setLoadingMore(true);
    const from = allTransactions.length;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from("transactions")
      .select("*, categories(*)")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (!error && data) {
      setAllTransactions((prev) => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    } else if (error) {
      alert("Error al cargar más movimientos: " + error.message);
      console.error("Error paginando transacciones:", error);
    }
    setLoadingMore(false);
  }

  async function handleDelete(id: string) {
    if (confirm("¿Quieres eliminar este movimiento?")) {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", id);
      if (!error) {
        fetchTransactions();
      } else {
        alert("Error al eliminar el movimiento: " + error.message);
        console.error("Error eliminando transacción:", error);
      }
    }
  }

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
      } else {
        setUser(user);
        await fetchTransactions();
      }
      setLoading(false);
    }

    init();
  }, [router]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const { totalIncome, totalExpense } = totals;
  const balance = totalIncome - totalExpense;

  if (loading) {
    return (
      <div className="min-h-screen bg-amber-50/30 dark:bg-gray-950 flex items-center justify-center">
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-500 animate-pulse">
          Cargando UnMango 🥭...
        </p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <main className="min-h-screen bg-gray-50/60 dark:bg-gray-950 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header con botón de privacidad y tema */}
        <header className="flex justify-between items-center bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🥭</span>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">UnMango</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Ayuda de atajos de teclado (solo desktop, no compite por espacio en mobile) */}
            <div
              className="hidden lg:flex items-center gap-2.5 text-[10px] text-gray-400 dark:text-gray-500 font-medium mr-1"
              title="Atajos de teclado: N para nueva transacción, P para modo privado, / para buscar"
            >
              <span><kbd className="px-1 py-0.5 rounded border border-gray-200 dark:border-gray-700 font-mono">N</kbd> nuevo</span>
              <span><kbd className="px-1 py-0.5 rounded border border-gray-200 dark:border-gray-700 font-mono">P</kbd> privado</span>
              <span><kbd className="px-1 py-0.5 rounded border border-gray-200 dark:border-gray-700 font-mono">/</kbd> buscar</span>
            </div>

            {/* Botón Modo Oscuro */}
            <button
              onClick={toggleTheme}
              title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
              className="p-2 sm:px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition shadow-sm flex items-center gap-2 text-xs font-semibold cursor-pointer"
            >
              {theme === "dark" ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-gray-500" />}
            </button>

            {/* Botón Modo Privacidad */}
            <button
              onClick={togglePrivacy}
              title={isPrivate ? "Mostrar valores" : "Ocultar valores"}
              className="p-2 sm:px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition shadow-sm flex items-center gap-2 text-xs font-semibold cursor-pointer"
            >
              {isPrivate ? (
                <>
                  <EyeOff size={16} className="text-amber-600" />
                  <span className="hidden sm:inline">Modo Privado</span>
                </>
              ) : (
                <>
                  <Eye size={16} className="text-gray-500 dark:text-gray-400" />
                  <span className="hidden sm:inline">Modo Visible</span>
                </>
              )}
            </button>

            {/* Botón Salir */}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 text-gray-700 dark:text-gray-200 text-xs font-semibold px-4 py-2 rounded-xl transition cursor-pointer"
            >
              <LogOut size={16} /> Salir
            </button>
          </div>
        </header>

        {/* Tarjetas de Métricas principales formateadas con formatAmount */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              Balance Disponible
            </p>
            <h3
              className={`text-2xl font-extrabold ${balance >= 0 ? "text-gray-900 dark:text-gray-100" : "text-rose-600"}`}
            >
              {formatAmount(balance)}
            </h3>
          </div>

          <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1 flex items-center gap-1">
              <ArrowUpRight size={14} /> Total Ingresos
            </p>
            <h3 className="text-2xl font-extrabold text-emerald-600">
              {isPrivate
                ? formatAmount(totalIncome)
                : `+ ${formatAmount(totalIncome)}`}
            </h3>
          </div>

          <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
            <p className="text-xs font-semibold text-rose-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <ArrowDownRight size={14} /> Total Gastos
            </p>
            <h3 className="text-2xl font-extrabold text-rose-600">
              {isPrivate
                ? formatAmount(totalExpense)
                : `- ${formatAmount(totalExpense)}`}
            </h3>
          </div>
        </div>

        <ZeroSpendStreak />

        {/* Formulario y Lateral (Gráfico + Categorías) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <TransactionForm onTransactionAdded={fetchTransactions} />
            <ImportTransactions onImported={fetchTransactions} />
            <RecurringManager onTransactionAdded={fetchTransactions} />
            <BudgetManager />
            <SavingsGoals />
          </div>

          <div className="lg:col-span-1 space-y-6">
            <FinanceChart income={totalIncome} expense={totalExpense} />
            <TrendChart />
            <WalletManager />
            <CategoryManager onCategoriesUpdated={fetchTransactions} />
            <BackupRestore />
          </div>
        </div>

        {/* Historial de Movimientos y Filtros */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Historial de Movimientos
            </h2>
          </div>

          <TransactionFilters
            transactions={allTransactions}
            onFiltered={setFilteredTransactions}
          />

          {filteredTransactions.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">
              No se encontraron movimientos con los filtros seleccionados.
            </p>
          ) : (
            <div className="space-y-3 pt-2">
              {filteredTransactions.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-xl ${
                        item.type === "income"
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600"
                          : "bg-rose-50 dark:bg-rose-950/40 text-rose-600"
                      }`}
                    >
                      {item.type === "income" ? (
                        <ArrowUpRight size={18} />
                      ) : (
                        <ArrowDownRight size={18} />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                          {item.description}
                        </p>
                        {item.categories && (
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                            style={{
                              backgroundColor: `${item.categories.color || '#94a3b8'}18`,
                              color: item.categories.color || '#94a3b8',
                            }}
                          >
                            {item.categories.name}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium flex items-center gap-2 mt-0.5">
                        <span>
                          {item.payment_method}
                          {item.wallet_provider
                            ? ` (${item.wallet_provider})`
                            : ""}
                        </span>
                        {item.is_usd && (
                          <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-300 text-[10px] px-1.5 py-0.5 rounded font-bold">
                            USD {isPrivate ? "••••••" : item.amount_usd}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      {/* Monto de cada transacción con privacidad */}
                      <p
                        className={`text-sm font-extrabold ${
                          item.type === "income"
                            ? "text-emerald-600"
                            : "text-rose-600"
                        }`}
                      >
                        {isPrivate
                          ? formatAmount(Number(item.amount_ars))
                          : `${item.type === "income" ? "+" : "-"} ${formatAmount(Number(item.amount_ars))}`}
                      </p>
                      <p className="text-[10px] text-gray-400 font-medium">
                        {new Date(item.created_at!).toLocaleDateString("es-AR")}
                      </p>
                    </div>

                    <button
                      onClick={() => item.id && handleDelete(item.id)}
                      className="text-gray-400 hover:text-rose-600 transition p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                      title="Eliminar movimiento"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {hasMore && (
            <div className="pt-2 flex justify-center">
              <button
                onClick={loadMoreTransactions}
                disabled={loadingMore}
                className="text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50 px-4 py-2 rounded-xl transition disabled:opacity-50 cursor-pointer"
              >
                {loadingMore ? "Cargando..." : "Cargar más movimientos"}
              </button>
            </div>
          )}
        </div>
      </div>

      <ArsUsdCalculator />
    </main>
  );
}
