"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { Transaction } from "@/types";
import TransactionForm from "@/components/TransactionForm";
import CategoryManager from "@/components/CategoryManager";
import BudgetManager from "@/components/BudgetManager";
import FinanceChart from "@/components/FinanceChart";
import TrendChart from "@/components/TrendChart";
import ExchangeGapSimulator from "@/components/ExchangeGapSimulator";
import TelegramLink from "@/components/TelegramLink";
import GoogleCalendarLink from "@/components/GoogleCalendarLink";
import WorkSettings from "@/components/WorkSettings";
import HouseholdLink from "@/components/HouseholdLink";
import PaymentDetailsSettings from "@/components/PaymentDetailsSettings";
import HouseholdExpenses from "@/components/HouseholdExpenses";
import TransactionFilters from "@/components/TransactionFilters";
import { usePrivacy } from "@/context/PrivacyContext";
import { useTheme } from "@/context/ThemeContext";
import { useUser } from "@/context/UserContext";
import { useDashboardData } from "@/context/DashboardDataContext";
import { useWallets } from "@/context/WalletsContext";
import { useToast } from "@/context/ToastContext";
import RecurringManager from "@/components/RecurringManager";
import WalletManager from "@/components/WalletManager";
import SavingsGoals from "@/components/SavingsGoals";
import ImportTransactions from "@/components/ImportTransactions";
import ZeroSpendStreak from "@/components/ZeroSpendStreak";
import BackupRestore from "@/components/BackupRestore";
import BudgetRule502030 from "@/components/BudgetRule502030";
import MonthEndProjection from "@/components/MonthEndProjection";
import AntExpenses from "@/components/AntExpenses";
import ShareBalanceCard from "@/components/ShareBalanceCard";
import SubscriptionPriceAlerts from "@/components/SubscriptionPriceAlerts";
import InstallmentTracker from "@/components/InstallmentTracker";
import DebtsManager from "@/components/DebtsManager";
import DollarRatesTable from "@/components/DollarRatesTable";
import RecentTransactions from "@/components/RecentTransactions";
import WalletCarousel from "@/components/WalletCarousel";
import FinancialHealthScoreWidget from "@/components/FinancialHealthScoreWidget";
import FinancialAdviceWidget from "@/components/FinancialAdviceWidget";
import SafeToSpendWidget from "@/components/SafeToSpendWidget";
import BottomNav, { TabId } from "@/components/nav/BottomNav";
import SettingsPanel from "@/components/nav/SettingsPanel";
import SpeedDialFab from "@/components/nav/SpeedDialFab";
import OfflineSyncManager from "@/components/OfflineSyncManager";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import {
  LogOut,
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Circle,
  Info,
  Settings as SettingsIcon,
} from "lucide-react";

// Cantidad de movimientos que se traen por página. El balance y los totales
// NO dependen de este número: se calculan del lado del servidor con la
// función get_transaction_totals (ver supabase/functions.sql), así que
// paginar la lista visual no afecta la exactitud de esas cifras.
const PAGE_SIZE = 50;

export default function Home() {
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<
    Transaction[]
  >([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("inicio");
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Contador que fuerza a los contextos compartidos de Inicio
  // (DashboardDataContext y WalletsContext) a refrescarse: los widgets
  // leen de ahí en vez de consultar Supabase por separado. Se bombea en
  // fetchTransactions() (cubre Carga Manual y "Pagar" en los managers) y
  // al cerrar Configuración (cubre billeteras y cualquier otro cambio ahí).
  const [dataVersion, setDataVersion] = useState(0);
  const router = useRouter();

  // Sesión cacheada a nivel global (ver AUDIT.md, Fase 1f): UserContext
  // resuelve user una sola vez y lo mantiene sincronizado con Supabase;
  // acá ya no se llama supabase.auth.getUser() en cada montaje ni por
  // cada fetch/paginación.
  const { user, loading: userLoading } = useUser();

  // Consumimos el contexto de privacidad y de tema
  const { isPrivate, togglePrivacy, formatAmount } = usePrivacy();
  const { theme, toggleTheme, oledBlack, toggleOledBlack } = useTheme();
  const { toast, confirmDialog } = useToast();

  // Datos compartidos por los widgets de la pestaña Inicio (totales del
  // mes, gastos, recurrentes, cuotas) y las billeteras con su saldo.
  const { data: dashboardData, refresh: refreshDashboard } = useDashboardData();
  const { wallets, totalBalance: walletsTotalBalance, refresh: refreshWallets } = useWallets();

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

  // Cada vez que cambia dataVersion (alta/baja de movimiento, cambio en
  // Configuración) los contextos compartidos se vuelven a traer — así
  // los widgets de Inicio quedan frescos sin que cada uno consulte por
  // su lado.
  useEffect(() => {
    refreshDashboard();
    refreshWallets();
  }, [dataVersion, refreshDashboard, refreshWallets]);

  // Primera página del historial (la más reciente). Se llama al iniciar y
  // después de cualquier alta/baja de movimiento. Usa el `user` cacheado
  // de UserContext (ya resuelto para cuando la app renderiza) en vez de
  // pedir la sesión a Supabase en cada llamada.
  const fetchTransactions = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("transactions")
      .select("*, categories(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(0, PAGE_SIZE - 1);

    if (!error && data) {
      setAllTransactions(data);
      setFilteredTransactions(data);
      setHasMore(data.length === PAGE_SIZE);
    }

    setDataVersion((v) => v + 1);
  }, [user]);

  // Trae la siguiente página y la agrega al final de lo ya cargado.
  async function loadMoreTransactions() {
    if (!user) return;

    setLoadingMore(true);
    const from = allTransactions.length;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from("transactions")
      .select("*, categories(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (!error && data) {
      setAllTransactions((prev) => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    } else if (error) {
      toast.error("Error al cargar más movimientos: " + error.message);
      console.error("Error paginando transacciones:", error);
    }
    setLoadingMore(false);
  }

  async function handleDelete(id: string) {
    const confirmed = await confirmDialog({
      title: "Eliminar movimiento",
      message: "¿Quieres eliminar este movimiento?",
      confirmText: "Eliminar",
      variant: "danger",
    });
    if (!confirmed) return;
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", id);
    if (!error) {
      fetchTransactions();
      toast.success("Movimiento eliminado.");
    } else {
      toast.error("Error al eliminar el movimiento: " + error.message);
      console.error("Error eliminando transacción:", error);
    }
  }

  useEffect(() => {
    // Espera a que UserContext resuelva la sesión antes de decidir si hay
    // que redirigir a /login o cargar los datos del usuario.
    if (userLoading) return;
    async function init() {
      if (!user) {
        router.push("/login");
      } else {
        await fetchTransactions();
      }
      setLoading(false);
    }
    init();
  }, [user, userLoading, router, fetchTransactions]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  // Los managers de Planes (RecurringManager, SavingsGoals, etc.) cargan
  // sus datos de forma asíncrona y muestran null mientras tanto — el id
  // del contenedor recién existe en el DOM una vez que terminan. Un
  // setTimeout fijo de 50ms no siempre alcanza (depende de la latencia
  // real de red), y si no encuentra el elemento simplemente no hace
  // nada, dejando la pantalla donde estaba (que puede ser otra sección
  // completamente distinta a la que se quería mostrar). Reintenta cada
  // 100ms hasta encontrarlo, con un límite de 3 segundos.
  function scrollToElementWhenReady(elementId: string, attemptsLeft = 30) {
    const el = document.getElementById(elementId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (attemptsLeft > 0) {
      setTimeout(() => scrollToElementWhenReady(elementId, attemptsLeft - 1), 100);
    }
  }

  function handleManualEntry() {
    setActiveTab("inicio");
    scrollToElementWhenReady("transaction-form");
    // Además del scroll, enfocamos el campo apenas esté disponible —
    // mismo mecanismo de reintento.
    (function focusWhenReady(attemptsLeft = 30) {
      const input = document.getElementById("transaction-description-input");
      if (input) {
        input.focus();
      } else if (attemptsLeft > 0) {
        setTimeout(() => focusWhenReady(attemptsLeft - 1), 100);
      }
    })();
  }

  function handleAdviceNavigate(target: { tab?: TabId; sectionId?: string; openSettings?: boolean }) {
    if (target.openSettings) {
      setSettingsOpen(true);
      return;
    }
    if (target.tab) setActiveTab(target.tab);
    if (target.sectionId) {
      scrollToElementWhenReady(target.sectionId);
    }
  }

  const totalIncome = dashboardData?.totalIncome ?? 0;
  const totalExpense = dashboardData?.totalExpense ?? 0;
  const balance = totalIncome - totalExpense;
  const totalWalletBalance = wallets.length > 0 ? walletsTotalBalance : null;

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
        <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🥭</span>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">UnMango</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Ayuda de atajos de teclado (solo desktop, no compite por espacio en mobile) */}
            <div
              className="hidden lg:flex items-center gap-2.5 text-[10px] text-gray-400 dark:text-gray-500 font-medium mr-1"
              title="Atajos de teclado: N para nueva transacción, P para modo privado, / para buscar"
            >
              <span><kbd className="px-1 py-0.5 rounded border border-gray-200 dark:border-gray-700 font-mono">N</kbd> nuevo</span>
              <span><kbd className="px-1 py-0.5 rounded border border-gray-200 dark:border-gray-700 font-mono">P</kbd> privado</span>
              <span><kbd className="px-1 py-0.5 rounded border border-gray-200 dark:border-gray-700 font-mono">/</kbd> buscar</span>
            </div>

            {/* Botón Configuración */}
            <button
              onClick={() => setSettingsOpen(true)}
              title="Configuración"
              className="p-2 sm:px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition shadow-sm flex items-center gap-2 text-xs font-semibold cursor-pointer"
            >
              <SettingsIcon size={16} />
            </button>

            {/* Botón Modo Oscuro */}
            <button
              onClick={toggleTheme}
              title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
              className="p-2 sm:px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition shadow-sm flex items-center gap-2 text-xs font-semibold cursor-pointer"
            >
              {theme === "dark" ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-gray-500" />}
            </button>

            {/* Toggle OLED (solo tiene sentido en modo oscuro) */}
            {theme === "dark" && (
              <button
                onClick={toggleOledBlack}
                title={oledBlack ? "Desactivar negro OLED" : "Activar negro OLED (ahorra batería)"}
                className={`p-2 sm:px-3 rounded-xl border text-xs font-semibold transition shadow-sm flex items-center gap-2 cursor-pointer ${
                  oledBlack
                    ? "bg-black border-gray-700 text-amber-400"
                    : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                <Circle size={16} fill={oledBlack ? "currentColor" : "none"} />
                <span className="hidden sm:inline">OLED</span>
              </button>
            )}

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

            <ShareBalanceCard balance={balance} totalIncome={totalIncome} totalExpense={totalExpense} />

            {/* Botón Salir */}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 text-gray-700 dark:text-gray-200 text-xs font-semibold px-4 py-2 rounded-xl transition cursor-pointer"
            >
              <LogOut size={16} /> Salir
            </button>
          </div>
        </header>

        {/* ===== Pestaña Inicio ===== */}
        {activeTab === "inicio" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <p
                    className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1"
                    title="Suma TODOS tus movimientos, tengan o no una billetera asignada. Por eso puede no coincidir con la suma de tus billeteras (Configuración) — esa solo cuenta lo que asignaste explícitamente a cada una, más su saldo inicial."
                  >
                    Balance Disponible <Info size={11} className="text-gray-300 dark:text-gray-600" />
                  </p>
                  <button
                    onClick={togglePrivacy}
                    title={isPrivate ? "Mostrar valores" : "Ocultar valores"}
                    className="text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition cursor-pointer shrink-0"
                  >
                    {isPrivate ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <h3
                  className={`text-2xl font-extrabold ${balance >= 0 ? "text-gray-900 dark:text-gray-100" : "text-rose-600"}`}
                >
                  {formatAmount(balance)}
                </h3>
                {totalWalletBalance !== null && (
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                    En billeteras: {isPrivate ? "••••••" : formatAmount(totalWalletBalance)}
                  </p>
                )}
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

            <div className="space-y-6 mt-6">
              <FinancialHealthScoreWidget />
              <FinancialAdviceWidget onNavigate={handleAdviceNavigate} />
              <WalletCarousel />
              <ZeroSpendStreak />
              <SafeToSpendWidget />
              <MonthEndProjection />
              <SubscriptionPriceAlerts />
              <TransactionForm onTransactionAdded={fetchTransactions} />
              <RecentTransactions transactions={allTransactions} onSeeAll={() => setActiveTab("historial")} />
            </div>
          </>
        )}

        {/* ===== Pestaña Análisis ===== */}
        {activeTab === "analisis" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <FinanceChart income={totalIncome} expense={totalExpense} />
            <TrendChart />
            <AntExpenses />
            <DollarRatesTable />
            <ExchangeGapSimulator />
            <BudgetRule502030 />
          </div>
        )}

        {/* ===== Pestaña Planes ===== */}
        {activeTab === "planes" && (
          <div className="space-y-6">
            <HouseholdExpenses />
            <RecurringManager onTransactionAdded={fetchTransactions} />
            <InstallmentTracker onTransactionAdded={fetchTransactions} />
            <DebtsManager onTransactionAdded={fetchTransactions} />
            <BudgetManager />
            <SavingsGoals />
          </div>
        )}

        {/* ===== Pestaña Historial ===== */}
        {activeTab === "historial" && (
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
                  className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`p-2.5 rounded-xl shrink-0 ${
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
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate max-w-[200px] sm:max-w-none">
                          {item.description}
                        </p>
                        {item.categories && (
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0"
                            style={{
                              backgroundColor: `${item.categories.color || '#94a3b8'}18`,
                              color: item.categories.color || '#94a3b8',
                            }}
                          >
                            {item.categories.name}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="truncate">
                          {item.payment_method}
                          {item.wallet_provider
                            ? ` (${item.wallet_provider})`
                            : ""}
                        </span>
                        {item.is_usd && (
                          <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-300 text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0">
                            USD {isPrivate ? "••••••" : item.amount_usd}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
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
        )}
      </div>

      {/* Espacio para que el contenido no quede tapado por el bottom nav fijo */}
      <div className="h-20" />

      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          setDataVersion((v) => v + 1);
        }}
      >
        <ImportTransactions onImported={fetchTransactions} />
        <WalletManager onWalletsUpdated={() => setDataVersion((v) => v + 1)} />
        <CategoryManager onCategoriesUpdated={fetchTransactions} />
        <BackupRestore />
        <TelegramLink />
        <GoogleCalendarLink />
        <WorkSettings />
        <HouseholdLink />
        <PaymentDetailsSettings />
      </SettingsPanel>

      <OfflineSyncManager onSynced={fetchTransactions} />

      <BottomNav activeTab={activeTab} onChange={setActiveTab} />

      <SpeedDialFab onTransactionAdded={fetchTransactions} onManualEntry={handleManualEntry} />
    </main>
  );
}
