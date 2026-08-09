import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Wallet,
  ArrowLeftRight,
  IndianRupee,
  AlertTriangle,
  MessageCircle,
  Sparkles,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import { enqueueSnackbar } from "notistack";
import { useDashboardQuery } from "../hooks/useDashboardQuery";
import { useSendOutreachMutation } from "../hooks/useSendOutreachMutation";
import { useFlaggedTransactionsQuery } from "../hooks/useRiskQueries";
import OutreachMessageDialog from "../components/commonModals/OutreachMessageDialog";
import RiskFlagChip from "../components/risk/RiskFlagChip";
import RiskReviewPanel from "../components/risk/RiskReviewPanel";

// Estimate how many days until an inmate's wallet balance hits zero,
// based on their average daily spend (returned by the dashboard API from
// their recent POS transaction history). Returns null when there isn't
// enough spending data to make a reliable estimate.
function getDaysToZero(balance, avgDailySpend) {
  if (balance === undefined || balance === null) return null;
  if (balance <= 0) return 0;
  if (!avgDailySpend || avgDailySpend <= 0) return null;
  return Math.ceil(balance / avgDailySpend);
}

// Draft a contextual outreach message using the inmate's current balance
// and Days to Zero estimate. This is only ever a starting point - staff
// review and edit it in the modal before anything is sent.
function buildOutreachDraft(inmate, daysToZero) {
  if (!inmate) return "";

  const name = [inmate.firstName, inmate.lastName].filter(Boolean).join(" ") || "Inmate";
  const balance = inmate.balance ?? 0;

  let urgency;
  if (daysToZero === null) {
    urgency = "is running low";
  } else if (daysToZero <= 0) {
    urgency = "has been fully depleted";
  } else {
    urgency = `is estimated to reach zero in about ${daysToZero} day${daysToZero === 1 ? "" : "s"}`;
  }

  return `Dear ${name} (ID: ${inmate.inmateId || "N/A"}), your canteen wallet balance is currently ₹${balance} and ${urgency}. Please arrange a top-up soon to avoid any interruption to canteen purchases. - Facility Administration`;
}

// Executive Dashboard Narrative: a short, plain-English summary of the
// numbers already loaded on this page. Purely template text built from the
// existing dashboard API response - no extra API/AI calls.
function buildDashboardNarrative(dash) {
  if (!dash) return "";

  const totalInmates = dash.totalInmates ?? 0;
  const totalBalance = dash.totalBalance ?? 0;
  const todayTransactionCount = dash.todayTransactionCount ?? 0;
  const totalSalesToday = dash.totalSalesToday ?? 0;
  const lowBalanceCount = dash.lowBalanceInmates?.length ?? 0;
  const reversedCount = (dash.recentTransactions || []).filter(
    (tx) => tx?.details?.is_reversed
  ).length;

  const sentences = [
    `${totalInmates} inmate${totalInmates === 1 ? "" : "s"} on record with a combined wallet balance of ₹${totalBalance}.`,
    `${todayTransactionCount} transaction${todayTransactionCount === 1 ? "" : "s"} today totaling ₹${totalSalesToday} in canteen sales.`,
  ];

  sentences.push(
    lowBalanceCount > 0
      ? `${lowBalanceCount} inmate${lowBalanceCount === 1 ? " is" : "s are"} running low on funds.`
      : "No inmates are currently running low on funds."
  );

  if (reversedCount > 0) {
    sentences.push(
      `${reversedCount} of the most recent transaction${reversedCount === 1 ? "" : "s"} ${
        reversedCount === 1 ? "was" : "were"
      } reversed and may be worth a look.`
    );
  }

  return sentences.join(" ");
}

// "Worth a look" links reuse the is_reversed flag already shown in the
// Recent Transactions table below (same data, no new backend field).
function getFlaggedTransactions(dash) {
  return (dash?.recentTransactions || [])
    .filter((tx) => tx?.details?.is_reversed)
    .slice(0, 3);
}

function describeFlaggedTransaction(tx) {
  const amount = Math.abs(tx.totalAmount ?? 0);
  const inmateId = tx.details?.inmateId;
  const who = inmateId ? `Inmate ${inmateId}` : tx.type || "Transaction";
  const date = tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : "";
  return `${who} — ₹${amount} reversed${date ? ` on ${date}` : ""}`;
}

// Deep-link straight to this transaction in Transaction History. `range`
// and `pageSize` are widened so the (typically very recent) reversed
// transaction is reliably on the first page of results; TransactionHistory
// reads these as optional params and falls back to its normal defaults
// when they're absent.
function buildTransactionDeepLink(tx) {
  const params = new URLSearchParams({
    highlight: tx._id,
    range: "yearly",
    pageSize: "50",
  });
  return `/transaction-history?${params.toString()}`;
}

// Turns a { percent, direction } week-over-week object (from the dashboard
// API's weekOverWeek field) into the small label shown under a stat card.
// Returns null when there's no trend data, so StatCard can skip rendering
// the badge entirely rather than showing something misleading.
function formatTrendLabel(trend) {
  if (!trend) return null;

  const arrow = trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "—";
  // percent is null when the previous week's value was zero and the metric
  // is now non-zero - a % change from zero isn't meaningful, so say "New"
  // instead of a fake number, while still showing the correct direction.
  const percentLabel = trend.percent === null ? "New" : `${trend.percent}%`;

  return `${arrow} ${percentLabel} vs last week`;
}

function StatCard({ title, value, icon: Icon, color, trend }) {
  const trendLabel = formatTrendLabel(trend);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl p-3 md:p-5 shadow-md bg-linear-to-br ${color}`}
    >
      <div className="absolute right-4 top-4 opacity-20">
        <Icon className="w-12 md:w-16 h-12 md:h-16" />
      </div>

      <p className="text-sm text-white/80">{title}</p>
      <h2 className="text-3xl font-bold text-white mt-2">{value ?? 0}</h2>
      {trendLabel && (
        <p className="text-xs text-white/90 font-medium mt-1.5">{trendLabel}</p>
      )}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { data, isLoading } = useDashboardQuery();
  const dash = data?.data;

  // Executive Dashboard Narrative: derived purely from already-loaded data.
  const dashboardNarrative = buildDashboardNarrative(dash);
  const flaggedTransactions = getFlaggedTransactions(dash);

  // Predictive Low-Balance Outreach: modal state + draft-review-send flow.
  const [outreachInmate, setOutreachInmate] = useState(null);
  const [outreachDraft, setOutreachDraft] = useState("");
  const sendOutreachMutation = useSendOutreachMutation();

  // Financial Anomaly & Fraud Detection: "Flagged for Review" panel + the
  // shared risk review modal (Confirm / False Positive / Investigate).
  const flaggedQuery = useFlaggedTransactionsQuery({ days: 7, limit: 5 });
  const [reviewTransaction, setReviewTransaction] = useState(null);

  const handleOpenRiskReview = (tx) => {
    setReviewTransaction({
      id: tx._id,
      source: tx.source,
      inmateId: tx.inmateId,
      amount: tx.amount,
      risk: tx.risk,
    });
  };

  const handleDraftOutreach = (inmate) => {
    const daysToZero = getDaysToZero(inmate.balance, inmate.avgDailySpend);
    setOutreachInmate(inmate);
    setOutreachDraft(buildOutreachDraft(inmate, daysToZero));
  };

  const handleCloseOutreach = () => {
    if (sendOutreachMutation.isPending) return;
    setOutreachInmate(null);
    setOutreachDraft("");
  };

  // Called only when staff click "Send" inside the review modal - never
  // triggered automatically.
  const handleSendOutreach = (editedMessage) => {
    if (!outreachInmate) return;

    sendOutreachMutation.mutate(
      { inmateId: outreachInmate.inmateId, message: editedMessage },
      {
        onSuccess: () => {
          enqueueSnackbar("Outreach message sent", { variant: "success" });
          setOutreachInmate(null);
          setOutreachDraft("");
        },
        onError: (error) => {
          enqueueSnackbar(
            error?.response?.data?.message || "Failed to send outreach message",
            { variant: "error" }
          );
        },
      }
    );
  };

  if (isLoading) {
    return <div className="p-6 text-gray-500">Loading dashboard...</div>;
  }

  return (
    <div className="bg-slate-100 space-y-6 p-3 md:p-5">
      {/* Header */}
      <div>
        <h1 className="text-lg md:text-2xl font-bold text-slate-800">
          Dashboard Overview
        </h1>
        <p className="text-sm md:text-base text-slate-500">
          Real-time financial statistics
        </p>
      </div>

      {/* 🧭 Executive Summary */}
      <div className="bg-white rounded-2xl shadow-sm border p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5 rounded-full bg-indigo-100 p-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              Today at a Glance
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {dashboardNarrative || "Dashboard data is not available right now."}
            </p>

            {flaggedTransactions.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Worth a look
                </p>
                <div className="flex flex-wrap gap-2">
                  {flaggedTransactions.map((tx) => (
                    <button
                      key={tx._id}
                      type="button"
                      onClick={() => navigate(buildTransactionDeepLink(tx))}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 hover:text-red-800 border border-red-200 hover:border-red-300 bg-red-50 hover:bg-red-100 rounded-lg px-2.5 py-1.5 transition"
                    >
                      {describeFlaggedTransaction(tx)}
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 🔢 Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-6">
        <StatCard
          title="Total Inmates"
          value={dash?.totalInmates}
          icon={Users}
          color="from-blue-500 to-blue-600"
          trend={dash?.weekOverWeek?.totalInmates}
        />

        <StatCard
          title="Wallet Balance"
          value={`₹ ${dash?.totalBalance || 0}`}
          icon={Wallet}
          color="from-emerald-500 to-emerald-600"
          trend={dash?.weekOverWeek?.totalBalance}
        />

        <StatCard
          title="Today's Transactions"
          value={dash?.todayTransactionCount}
          icon={ArrowLeftRight}
          color="from-violet-500 to-violet-600"
          trend={dash?.weekOverWeek?.todayTransactionCount}
        />

        <StatCard
          title="Today's Sales"
          value={`₹ ${dash?.totalSalesToday || 0}`}
          icon={IndianRupee}
          color="from-orange-500 to-orange-600"
          trend={dash?.weekOverWeek?.totalSalesToday}
        />
      </div>

      {/* 📊 Second Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent Transactions */}
        {/* <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm border">
          <div className="p-5 border-b flex items-center justify-between">
            <h2 className="text-lg font-bold">Recent Transactions</h2>
            <span className="text-xs text-slate-400">Latest 5</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left p-4">Student</th>
                  <th className="text-left p-4">Reg No</th>
                  <th className="text-left p-4">Amount</th>
                  <th className="text-left p-4">Type</th>
                  <th className="text-left p-4">Status</th>
                  <th className="text-left p-4">Date</th>
                </tr>
              </thead>

              <tbody>
                {dash?.recentTransactions?.map((tx) => (
                  <tr
                    key={tx._id}
                    className="border-t hover:bg-slate-50 transition"
                  >
                    <td className="p-4 font-medium">
                      {tx.details?.student_id?.student_name}
                    </td>
                    <td className="p-4">
                      {tx.details?.student_id?.registration_number}
                    </td>
                    <td className="p-4 font-semibold text-green-600">
                      ₹ {tx.totalAmount}
                    </td>
                    <td className="p-4">{tx.type}</td>
                    <td className="p-4">
                      <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs">
                        {tx.details?.status}
                      </span>
                    </td>
                    <td className="p-4 text-slate-500">
                      {new Date(tx.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div> */}

        {/* Recent Transactions */}
        <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm border">
          <div className="p-4 sm:p-5 border-b flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold">Recent Transactions</h2>
            <span className="text-xs text-slate-400">Latest 5</span>
          </div>

          {/* ✅ Mobile view (cards) */}
          <div className="md:hidden p-3 space-y-3">
            {dash?.recentTransactions?.map((tx) => {
              const isReversed = tx.details?.is_reversed;
              const amountValue = isReversed
                ? `-₹ ${Math.abs(tx.totalAmount ?? 0)}`
                : `₹ ${tx.totalAmount ?? 0}`;
              const amountClass = isReversed ? "text-red-600" : "text-green-600";
              const statusLabel = isReversed
                ? "Transaction reversed"
                : tx.details?.status || "OK";
              const statusClass = isReversed
                ? "bg-red-100 text-red-700"
                : "bg-green-100 text-green-700";
              const formattedDate = new Date(tx.createdAt);

              return (
                <div key={tx._id} className="border rounded-xl p-3 bg-white">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">
                        {tx.details?.student_id?.student_name || "-"}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        Reg: {tx.details?.student_id?.registration_number || "-"}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className={`font-bold ${amountClass}`}>
                        {amountValue}
                      </p>
                      <p className="text-xs text-slate-500">{tx.type}</p>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs ${statusClass}`}>
                      {statusLabel}
                    </span>
                    <span className="text-xs text-slate-500">
                      {formattedDate.toLocaleDateString()} {" "}
                      {formattedDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {/* ✅ Desktop/tablet view (table) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left p-4">Inmate</th>
                  <th className="text-left p-4">Amount</th>
                  <th className="text-left p-4">Type</th>
                  <th className="text-left p-4">Status</th>
                  <th className="text-left p-4">Date</th>
                </tr>
              </thead>

              <tbody>
                {dash?.recentTransactions?.map((tx) => {
                  const isReversed = tx.details?.is_reversed;
                  const amountValue = isReversed
                    ? -Math.abs(tx.totalAmount ?? 0)
                    : tx.totalAmount ?? 0;
                  const statusLabel = isReversed
                    ? "Transaction reversed"
                    : tx.details?.status || "Completed";
                  const statusClass = isReversed
                    ? "bg-red-100 text-red-700"
                    : "bg-green-100 text-green-700";
                  const formattedDate = new Date(tx.createdAt);

                  return (
                    <tr key={tx._id} className="border-t hover:bg-slate-50 transition">
                      <td className="p-4 font-medium">
                        {tx.details?.inmateId}
                      </td>
                      <td className={`p-4 font-semibold ${isReversed ? "text-red-600" : "text-green-600"}`}>
                        ₹ {amountValue}
                      </td>
                      <td className="p-4">{tx.type}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${statusClass}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="p-4 text-slate-500">
                        {formattedDate.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 🚨 Low Balance Alerts */}
        <div className="bg-white rounded-2xl shadow-sm border">
          <div className="p-4 sm:p-5 border-b flex items-center gap-2">
            <AlertTriangle className="text-red-500 w-5 h-5" />
            <h2 className="text-base sm:text-lg font-bold">Low Balance Alerts</h2>
          </div>

          <div className="p-3 sm:p-5 space-y-3">
            {dash?.lowBalanceInmates?.length === 0 ? (
              <div className="text-sm text-slate-500">No low balance students 🎉</div>
            ) : (
              dash?.lowBalanceInmates?.map((s) => {
                const daysToZero = getDaysToZero(s.balance, s.avgDailySpend);
                const daysToZeroLabel =
                  daysToZero === null
                    ? "N/A"
                    : `${daysToZero} day${daysToZero === 1 ? "" : "s"}`;
                const daysToZeroClass =
                  daysToZero === null
                    ? "text-slate-400"
                    : daysToZero <= 7
                    ? "text-red-600"
                    : "text-amber-600";

                return (
                  <div
                    key={s._id}
                    className="border rounded-xl p-3 hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{s.firstName} - {s.lastName}</p>
                        <p className="text-xs text-slate-500 truncate">{s.inmateId}</p>
                        <p className="text-xs text-slate-500 mt-1 truncate">
                          Days to Zero:{" "}
                          <span className={`font-semibold ${daysToZeroClass}`}>
                            {daysToZeroLabel}
                          </span>
                        </p>
                      </div>

                      <span className="shrink-0 text-red-600 font-bold whitespace-nowrap">
                        ₹ {s.balance}
                      </span>
                    </div>

                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleDraftOutreach(s)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-300 bg-blue-50 hover:bg-blue-100 rounded-lg px-2.5 py-1.5 transition"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Draft Outreach Message
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* 🚩 Flagged for Review (Financial Anomaly & Fraud Detection) */}
      <div className="bg-white rounded-2xl shadow-sm border">
        <div className="p-4 sm:p-5 border-b flex items-center gap-2">
          <ShieldAlert className="text-red-500 w-5 h-5" />
          <h2 className="text-base sm:text-lg font-bold">Flagged for Review</h2>
          <span className="text-xs text-slate-400 ml-auto">Last 7 days</span>
        </div>

        <div className="p-3 sm:p-5 space-y-3">
          {flaggedQuery.isLoading ? (
            <div className="text-sm text-slate-500">Loading flagged transactions...</div>
          ) : flaggedQuery.isError ? (
            <div className="text-sm text-slate-500">Flagged transactions are unavailable right now.</div>
          ) : !flaggedQuery.data?.flagged?.length ? (
            <div className="text-sm text-slate-500">No transactions flagged for review 🎉</div>
          ) : (
            flaggedQuery.data.flagged.map((tx) => (
              <button
                key={tx._id}
                type="button"
                onClick={() => handleOpenRiskReview(tx)}
                className="w-full text-left border rounded-xl p-3 hover:shadow-sm hover:border-red-200 transition"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">Inmate {tx.inmateId || "-"}</p>
                    <p className="text-xs text-slate-500 truncate">
                      ₹{Math.abs(tx.amount ?? 0)} • {tx.source}
                      {tx.eventDate ? ` • ${new Date(tx.eventDate).toLocaleString()}` : ""}
                    </p>
                  </div>
                  <RiskFlagChip risk={tx.risk} />
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <OutreachMessageDialog
        open={Boolean(outreachInmate)}
        inmate={outreachInmate}
        defaultMessage={outreachDraft}
        onClose={handleCloseOutreach}
        onSend={handleSendOutreach}
        sending={sendOutreachMutation.isPending}
      />

      <RiskReviewPanel
        open={Boolean(reviewTransaction)}
        transaction={reviewTransaction}
        onClose={() => setReviewTransaction(null)}
      />
    </div>
  );
}

