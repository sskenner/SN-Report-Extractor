import { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "wouter";
import {
  useListReports,
  useCreateReport,
  useUpdateReport,
  useDeleteReport,
  useVerifyReport,
  useListReportRuns,
  useLatestReportRun,
  getListReportsQueryKey,
  getListReportRunsQueryKey,
  getLatestReportRunQueryKey,
} from "@workspace/api-client-react";
import type { ReportConfig, ReportRun } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  ShieldCheck,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Play,
  Clock,
  AlertTriangle,
  History,
} from "lucide-react";
import { motion } from "framer-motion";

type FormState = {
  name: string;
  sysId: string;
  filterQuery: string;
  fields: string;
};

const EMPTY_FORM: FormState = { name: "", sysId: "", filterQuery: "", fields: "" };

function fmtDuration(startedAt: number | string | Date, completedAt?: string | Date | null): string {
  const start = typeof startedAt === "number" ? startedAt : new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const secs = Math.round((end - start) / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function fmtDate(d: string | Date): string {
  return new Date(d).toLocaleString();
}

function RunStatusBadge({ status }: { status: string }) {
  if (status === "success")
    return <span className="text-green-500 font-mono text-xs">✓ success</span>;
  if (status === "error")
    return <span className="text-destructive font-mono text-xs">✗ error</span>;
  return <span className="text-yellow-500 font-mono text-xs animate-pulse">⟳ running</span>;
}

function RunHistoryList({ runs }: { runs: ReportRun[] }) {
  if (runs.length === 0) {
    return (
      <p className="text-xs text-muted-foreground font-mono py-2">No runs yet.</p>
    );
  }
  return (
    <div className="space-y-1">
      {runs.map((run) => (
        <div
          key={run.id}
          className="flex items-center gap-3 text-xs font-mono py-1.5 border-b border-border/30 last:border-0"
          data-testid={`run-history-${run.id}`}
        >
          <RunStatusBadge status={run.status} />
          <span className="text-muted-foreground">
            {fmtDate(run.startedAt)}
          </span>
          <span className="text-foreground">{run.recordCount.toLocaleString()} records</span>
          {run.completedAt && (
            <span className="text-muted-foreground">
              {fmtDuration(run.startedAt, run.completedAt)}
            </span>
          )}
          {run.status === "error" && run.errorMessage && (
            <span className="text-destructive truncate max-w-xs" title={run.errorMessage}>
              {run.errorMessage.slice(0, 80)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function RunPanel({ report }: { report: ReportConfig }) {
  const queryClient = useQueryClient();
  const [isRunning, setIsRunning] = useState(false);
  const [runLog, setRunLog] = useState<string[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);

  const { data: latestRun } = useLatestReportRun(report.id, {
    query: {
      queryKey: getLatestReportRunQueryKey(report.id),
      refetchInterval: isRunning ? 1500 : false,
      retry: false,
    },
  });

  const { data: runs, refetch: refetchRuns } = useListReportRuns(report.id, {
    query: {
      queryKey: getListReportRunsQueryKey(report.id),
      enabled: showHistory,
      retry: false,
    },
  });

  const addLog = useCallback((line: string) => {
    setRunLog((prev) => {
      const next = [...prev, line];
      return next;
    });
    setTimeout(() => {
      if (logRef.current) {
        logRef.current.scrollTop = logRef.current.scrollHeight;
      }
    }, 30);
  }, []);

  useEffect(() => {
    if (!isRunning || !latestRun) return;
    const elapsed = fmtDuration(startTimeRef.current);
    const count = latestRun.recordCount ?? 0;
    if (latestRun.status === "running" && count > 0) {
      setRunLog((prev) => {
        const last = prev[prev.length - 1] ?? "";
        const progressLine = `  ↳ ${count.toLocaleString()} records fetched so far… (${elapsed})`;
        if (last.startsWith("  ↳")) {
          return [...prev.slice(0, -1), progressLine];
        }
        return [...prev, progressLine];
      });
    }
  }, [latestRun, isRunning]);

  const handleRun = useCallback(async () => {
    if (!report.verifiedTable) return;

    setIsRunning(true);
    setRunLog([]);
    setLastError(null);
    startTimeRef.current = Date.now();

    const controller = new AbortController();
    abortRef.current = controller;

    addLog(`▶ Starting run: ${report.name}`);
    addLog(`  Table: ${report.verifiedTable}`);
    if (report.filterQuery) addLog(`  Filter: ${report.filterQuery.slice(0, 80)}${report.filterQuery.length > 80 ? "…" : ""}`);
    addLog(`  Fetching pages (100 records each, 60s timeout per page)…`);

    try {
      const response = await fetch(`/api/reports/${report.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(body.error ?? `HTTP ${response.status}`);
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("text/csv")) {
        throw new Error("Expected CSV response but got: " + contentType);
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const match = disposition.match(/filename="?([^";\n]+)"?/);
      const filename = match?.[1] ?? `${report.name}_export.csv`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      const elapsed = fmtDuration(startTimeRef.current);
      const finalCount = latestRun?.recordCount ?? "?";
      addLog(`✓ Complete — ${typeof finalCount === "number" ? finalCount.toLocaleString() : finalCount} records in ${elapsed}`);
      addLog(`  Downloaded: ${filename}`);

      queryClient.invalidateQueries({ queryKey: getListReportRunsQueryKey(report.id) });
      if (showHistory) refetchRuns();
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        addLog("⚠ Run cancelled.");
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        setLastError(msg);
        addLog(`✗ Error: ${msg}`);
        queryClient.invalidateQueries({ queryKey: getListReportRunsQueryKey(report.id) });
        if (showHistory) refetchRuns();
      }
    } finally {
      setIsRunning(false);
      abortRef.current = null;
    }
  }, [report, addLog, latestRun, queryClient, showHistory, refetchRuns]);

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  const canRun = !!report.verifiedTable && !isRunning;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {isRunning ? (
          <Button
            size="sm"
            variant="destructive"
            onClick={handleCancel}
            data-testid={`button-cancel-run-${report.id}`}
          >
            <XCircle className="w-4 h-4 mr-1" />
            Cancel
          </Button>
        ) : (
          <Button
            size="sm"
            variant="default"
            onClick={handleRun}
            disabled={!canRun}
            title={!report.verifiedTable ? "Verify this report before running" : "Run report and download CSV"}
            data-testid={`button-run-${report.id}`}
          >
            <Play className="w-4 h-4 mr-1" />
            Run
          </Button>
        )}
        {isRunning && (
          <div className="flex items-center gap-1.5 text-xs text-yellow-500 font-mono">
            <Spinner className="w-3 h-3" />
            Running…
          </div>
        )}
        {!report.verifiedTable && !isRunning && (
          <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Verify first to enable Run
          </span>
        )}
        <button
          className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
          onClick={() => {
            setShowHistory((v) => !v);
            if (!showHistory) refetchRuns();
          }}
          data-testid={`button-toggle-history-${report.id}`}
        >
          <History className="w-3 h-3" />
          {showHistory ? "Hide history" : "Show history"}
        </button>
      </div>

      {runLog.length > 0 && (
        <div
          ref={logRef}
          className="bg-black/40 border border-border rounded-md p-3 max-h-40 overflow-y-auto font-mono text-xs space-y-0.5 text-green-400"
          data-testid={`run-log-${report.id}`}
        >
          {runLog.map((line, i) => (
            <div
              key={i}
              className={
                line.startsWith("✗")
                  ? "text-destructive"
                  : line.startsWith("⚠")
                  ? "text-yellow-500"
                  : line.startsWith("✓")
                  ? "text-green-400"
                  : "text-muted-foreground"
              }
            >
              {line}
            </div>
          ))}
        </div>
      )}

      {lastError && !isRunning && (
        <div
          className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3 font-mono"
          data-testid={`run-error-${report.id}`}
        >
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span className="break-all">{lastError}</span>
        </div>
      )}

      {showHistory && (
        <div data-testid={`run-history-panel-${report.id}`}>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            Run History
          </p>
          {runs ? (
            <RunHistoryList runs={runs} />
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
              <Spinner className="w-3 h-3" />
              Loading…
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReportForm({
  initial,
  onSubmit,
  onCancel,
  isSubmitting,
}: {
  initial: FormState;
  onSubmit: (v: FormState) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const inputCls =
    "w-full bg-muted/40 border border-border rounded-md px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
      className="space-y-4"
      data-testid="form-report"
    >
      <div className="space-y-1">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</label>
        <input
          className={inputCls}
          value={form.name}
          onChange={set("name")}
          placeholder="ESD Daily Tickets"
          required
          data-testid="input-name"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sys ID</label>
        <input
          className={inputCls}
          value={form.sysId}
          onChange={set("sysId")}
          placeholder="77803133c34cc310a69db6fdd4013190"
          required
          data-testid="input-sys-id"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filter Query</label>
        <input
          className={inputCls}
          value={form.filterQuery}
          onChange={set("filterQuery")}
          placeholder="numberLIKEINC^opened_atON..."
          data-testid="input-filter-query"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Fields (comma-separated)
        </label>
        <textarea
          className={`${inputCls} min-h-20 resize-y`}
          value={form.fields}
          onChange={set("fields")}
          placeholder="number,assignment_group,state,..."
          data-testid="input-fields"
        />
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} data-testid="button-cancel">
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting} data-testid="button-submit">
          {isSubmitting ? <Spinner className="w-4 h-4 mr-2" /> : null}
          Save
        </Button>
      </div>
    </form>
  );
}

function DeleteConfirm({
  name,
  onConfirm,
  onCancel,
  isDeleting,
}: {
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-2" data-testid="container-delete-confirm">
      <p className="text-sm text-muted-foreground text-center">
        Delete <span className="font-semibold text-foreground">"{name}"</span>? This cannot be undone.
      </p>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onCancel} data-testid="button-cancel-delete">
          Cancel
        </Button>
        <Button
          variant="destructive"
          onClick={onConfirm}
          disabled={isDeleting}
          data-testid="button-confirm-delete"
        >
          {isDeleting ? <Spinner className="w-4 h-4 mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
          Delete
        </Button>
      </div>
    </div>
  );
}

function ReportRow({
  report,
  onEdit,
  onDelete,
}: {
  report: ReportConfig;
  onEdit: (r: ReportConfig) => void;
  onDelete: (r: ReportConfig) => void;
}) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const { mutate: verify, isPending: isVerifying } = useVerifyReport({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListReportsQueryKey() });
      },
    },
  });

  return (
    <div
      className="border border-border rounded-lg overflow-hidden"
      data-testid={`row-report-${report.id}`}
    >
      <div className="flex items-center gap-3 px-4 py-3 bg-card/50">
        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground truncate" data-testid={`text-report-name-${report.id}`}>
            {report.name}
          </p>
          <p className="text-xs font-mono text-muted-foreground truncate" data-testid={`text-report-sysid-${report.id}`}>
            {report.sysId}
          </p>
        </div>

        {report.verifiedTitle ? (
          <div
            className="hidden sm:flex items-center gap-1.5 text-xs text-green-500 font-mono"
            data-testid={`badge-verified-${report.id}`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="truncate max-w-32">{report.verifiedTitle}</span>
          </div>
        ) : (
          <div
            className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground font-mono"
            data-testid={`badge-unverified-${report.id}`}
          >
            <XCircle className="w-3.5 h-3.5" />
            unverified
          </div>
        )}

        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpanded((e) => !e)}
            aria-label={expanded ? "Collapse" : "Expand"}
            data-testid={`button-expand-${report.id}`}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => verify({ id: report.id })}
            disabled={isVerifying}
            aria-label="Verify"
            data-testid={`button-verify-${report.id}`}
          >
            {isVerifying ? <Spinner className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onEdit(report)}
            aria-label="Edit"
            data-testid={`button-edit-${report.id}`}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(report)}
            aria-label="Delete"
            data-testid={`button-delete-${report.id}`}
          >
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </div>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="border-t border-border px-4 py-3 bg-muted/20 space-y-4"
          data-testid={`container-expanded-${report.id}`}
        >
          <div className="space-y-2 text-xs font-mono">
            {report.verifiedTitle && (
              <div className="flex gap-2">
                <span className="text-muted-foreground w-20 shrink-0">TITLE:</span>
                <span className="text-green-500" data-testid={`text-verified-title-${report.id}`}>{report.verifiedTitle}</span>
              </div>
            )}
            {report.verifiedTable && (
              <div className="flex gap-2">
                <span className="text-muted-foreground w-20 shrink-0">TABLE:</span>
                <span className="text-foreground" data-testid={`text-verified-table-${report.id}`}>{report.verifiedTable}</span>
              </div>
            )}
            {report.filterQuery && (
              <div className="flex gap-2">
                <span className="text-muted-foreground w-20 shrink-0">FILTER:</span>
                <span className="text-foreground break-all">{report.filterQuery}</span>
              </div>
            )}
            {report.fields && (
              <div className="flex gap-2">
                <span className="text-muted-foreground w-20 shrink-0">FIELDS:</span>
                <span className="text-foreground break-all">{report.fields}</span>
              </div>
            )}
            {report.verifiedAt && (
              <div className="flex gap-2">
                <span className="text-muted-foreground w-20 shrink-0">VERIFIED:</span>
                <span className="text-muted-foreground">
                  {new Date(report.verifiedAt).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          <div className="border-t border-border/40 pt-3">
            <RunPanel report={report} />
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default function Reports() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"list" | "add" | "edit" | "delete">("list");
  const [selected, setSelected] = useState<ReportConfig | null>(null);

  const { data: reports, isLoading, isError } = useListReports();

  const { mutate: createReport, isPending: isCreating } = useCreateReport({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListReportsQueryKey() });
        setMode("list");
      },
    },
  });

  const { mutate: updateReport, isPending: isUpdating } = useUpdateReport({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListReportsQueryKey() });
        setMode("list");
        setSelected(null);
      },
    },
  });

  const { mutate: deleteReport, isPending: isDeleting } = useDeleteReport({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListReportsQueryKey() });
        setMode("list");
        setSelected(null);
      },
    },
  });

  const handleEdit = (r: ReportConfig) => {
    setSelected(r);
    setMode("edit");
  };

  const handleDelete = (r: ReportConfig) => {
    setSelected(r);
    setMode("delete");
  };

  const handleCreateSubmit = (form: FormState) => {
    createReport({ data: form });
  };

  const handleEditSubmit = (form: FormState) => {
    if (!selected) return;
    updateReport({ id: selected.id, data: form });
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" data-testid="button-back">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            </Link>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" />
              Report Configurations
            </h1>
          </div>
          {mode === "list" && (
            <Button onClick={() => setMode("add")} data-testid="button-add-report">
              <Plus className="w-4 h-4 mr-1" />
              Add Report
            </Button>
          )}
        </div>

        {(mode === "add" || mode === "edit") && (
          <Card className="border-border bg-card/50" data-testid="card-form">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="text-base">
                {mode === "add" ? "New Report Configuration" : `Edit: ${selected?.name}`}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <ReportForm
                initial={
                  mode === "edit" && selected
                    ? {
                        name: selected.name,
                        sysId: selected.sysId,
                        filterQuery: selected.filterQuery,
                        fields: selected.fields,
                      }
                    : EMPTY_FORM
                }
                onSubmit={mode === "add" ? handleCreateSubmit : handleEditSubmit}
                onCancel={() => {
                  setMode("list");
                  setSelected(null);
                }}
                isSubmitting={isCreating || isUpdating}
              />
            </CardContent>
          </Card>
        )}

        {mode === "delete" && selected && (
          <Card className="border-destructive/30 bg-destructive/5" data-testid="card-delete">
            <CardContent className="pt-6">
              <DeleteConfirm
                name={selected.name}
                onConfirm={() => deleteReport({ id: selected.id })}
                onCancel={() => {
                  setMode("list");
                  setSelected(null);
                }}
                isDeleting={isDeleting}
              />
            </CardContent>
          </Card>
        )}

        <div className="space-y-3" data-testid="list-reports">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm font-mono py-8 justify-center" data-testid="text-reports-loading">
              <Spinner className="w-4 h-4" />
              Loading report configurations...
            </div>
          ) : isError ? (
            <div className="text-center py-8 text-destructive text-sm font-mono" data-testid="text-reports-error">
              Failed to load report configurations.
            </div>
          ) : reports && reports.length > 0 ? (
            reports.map((report) => (
              <ReportRow
                key={report.id}
                report={report}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))
          ) : (
            <div
              className="text-center py-12 text-muted-foreground text-sm font-mono"
              data-testid="text-reports-empty"
            >
              No report configurations yet. Click "Add Report" to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
