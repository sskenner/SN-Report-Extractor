import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { useTestDataStatus } from "@workspace/api-client-react";
import { getTestDataStatusQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  ArrowLeft,
  FlaskConical,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Play,
  StopCircle,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

function fmtElapsed(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="w-full bg-muted/40 rounded-full h-2.5 overflow-hidden">
      <div
        className="bg-primary h-2.5 rounded-full transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function TestData() {
  const queryClient = useQueryClient();
  const [count, setCount] = useState<number>(2000);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const { data: status } = useTestDataStatus({
    query: {
      queryKey: getTestDataStatusQueryKey(),
      refetchInterval: polling ? 1000 : false,
      retry: false,
    },
  });

  useEffect(() => {
    if (status?.running) {
      setPolling(true);
      if (!startTimeRef.current) startTimeRef.current = status.startedAt ?? Date.now();
    } else if (status && !status.running && polling) {
      setPolling(false);
    }
  }, [status, polling]);

  useEffect(() => {
    if (!polling) return;
    const timer = setInterval(() => {
      if (startTimeRef.current) {
        setElapsedMs(Date.now() - startTimeRef.current);
      }
    }, 500);
    return () => clearInterval(timer);
  }, [polling]);

  const handleGenerate = async () => {
    setIsStarting(true);
    setStartError(null);
    startTimeRef.current = null;
    setElapsedMs(0);

    try {
      const response = await fetch("/api/test-data/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count }),
      });

      const body = await response.json();

      if (!response.ok) {
        setStartError(body.error ?? `HTTP ${response.status}`);
        return;
      }

      startTimeRef.current = body.startedAt ?? Date.now();
      setPolling(true);
      queryClient.invalidateQueries({ queryKey: getTestDataStatusQueryKey() });
    } catch (err) {
      setStartError(err instanceof Error ? err.message : "Failed to start generation.");
    } finally {
      setIsStarting(false);
    }
  };

  const isRunning = status?.running ?? false;
  const total = status?.total ?? 0;
  const created = status?.created ?? 0;
  const failed = status?.failed ?? 0;
  const isComplete = !isRunning && total > 0 && status?.completedAt != null;
  const durationMs = isComplete && status?.startedAt && status?.completedAt
    ? status.completedAt - status.startedAt
    : null;

  const canStart = !isRunning && !isStarting && count >= 1 && count <= 2000;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-6">

        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-primary" />
            Test Data Generator
          </h1>
        </div>

        <Card className="border-yellow-500/30 bg-yellow-500/5" data-testid="card-warning">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-yellow-500">Warning — Live PDI Operation</p>
                <p className="text-xs text-muted-foreground">
                  This creates real incident records in your connected ServiceNow instance.
                  Generated records <span className="font-semibold text-foreground">cannot be automatically deleted</span>.
                  Only use this on a Personal Development Instance (PDI).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/50" data-testid="card-config">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-base">Configuration</CardTitle>
          </CardHeader>
          <CardContent className="pt-5 space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Number of Incidents
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={2000}
                  value={count}
                  onChange={(e) => setCount(Math.max(1, Math.min(2000, Number(e.target.value))))}
                  disabled={isRunning}
                  className="w-32 bg-muted/40 border border-border rounded-md px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                  data-testid="input-count"
                />
                <span className="text-xs text-muted-foreground font-mono">min 1 / max 2000</span>
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                Cycles through 5 categories, 4 priorities, 5 states.
                Each record uses a unique index for its short description.
              </p>
            </div>

            {startError && (
              <div
                className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3 font-mono"
                data-testid="text-start-error"
              >
                <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span className="break-all">{startError}</span>
              </div>
            )}

            <Button
              onClick={handleGenerate}
              disabled={!canStart}
              className="w-full sm:w-auto"
              data-testid="button-generate"
            >
              {isStarting ? (
                <>
                  <Spinner className="w-4 h-4 mr-2" />
                  Starting…
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Generate {count.toLocaleString()} Records
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {(isRunning || isComplete || total > 0) && (
          <Card className="border-border bg-card/50" data-testid="card-progress">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                {isRunning ? (
                  <>
                    <Spinner className="w-4 h-4" />
                    <span className="text-yellow-500">Generating…</span>
                  </>
                ) : isComplete ? (
                  failed === 0 ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span className="text-green-500">Complete</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 text-yellow-500" />
                      <span className="text-yellow-500">Complete with errors</span>
                    </>
                  )
                ) : (
                  <StopCircle className="w-4 h-4 text-muted-foreground" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                  <span data-testid="text-progress-count">
                    {created.toLocaleString()} / {total.toLocaleString()} records
                  </span>
                  <span data-testid="text-progress-elapsed">
                    {isRunning
                      ? `${fmtElapsed(elapsedMs)} elapsed`
                      : durationMs != null
                      ? `${fmtElapsed(durationMs)} total`
                      : ""}
                  </span>
                </div>
                <ProgressBar value={created} max={total} />
              </div>

              <div
                className="grid grid-cols-3 gap-3"
                data-testid="container-summary"
              >
                <div className="bg-muted/30 rounded-lg p-3 text-center space-y-1">
                  <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Created</p>
                  <p className="text-2xl font-bold text-green-500 font-mono" data-testid="text-created-count">
                    {created.toLocaleString()}
                  </p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 text-center space-y-1">
                  <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Failed</p>
                  <p className={`text-2xl font-bold font-mono ${failed > 0 ? "text-destructive" : "text-muted-foreground"}`} data-testid="text-failed-count">
                    {failed.toLocaleString()}
                  </p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 text-center space-y-1">
                  <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Duration</p>
                  <p className="text-2xl font-bold text-foreground font-mono" data-testid="text-duration">
                    {isRunning
                      ? fmtElapsed(elapsedMs)
                      : durationMs != null
                      ? fmtElapsed(durationMs)
                      : "—"}
                  </p>
                </div>
              </div>

              {status?.recentErrors && status.recentErrors.length > 0 && (
                <div data-testid="container-errors">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Recent Errors ({status.recentErrors.length})
                  </p>
                  <div className="bg-black/40 border border-border rounded-md p-3 max-h-40 overflow-y-auto space-y-1 font-mono text-xs text-destructive">
                    {status.recentErrors.map((e, i) => (
                      <div key={i}>{e}</div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
