import { useState } from "react";
import { Link } from "wouter";
import {
  useServicenowConfig,
  useServicenowPing,
  getServicenowPingQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Server, Activity, CheckCircle2, XCircle, Globe, AlertTriangle, FileText } from "lucide-react";
import { motion } from "framer-motion";
import { Spinner } from "@/components/ui/spinner";

export default function Home() {
  const [hasTested, setHasTested] = useState(false);

  const {
    data: config,
    isLoading: isLoadingConfig,
    isError: isConfigError,
    error: configError,
  } = useServicenowConfig();

  const {
    data: pingResult,
    isLoading,
    isFetching,
    isError: isPingError,
    error: pingError,
    refetch,
  } = useServicenowPing({
    query: {
      enabled: false,
      queryKey: getServicenowPingQueryKey(),
    },
  });

  const handleTestConnection = () => {
    setHasTested(true);
    refetch();
  };

  const isTesting = isLoading || isFetching;

  const pingNetworkError =
    hasTested && isPingError && pingError
      ? (pingError as Error).message ?? "Network error — could not reach the API server."
      : null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground flex items-center justify-center gap-3">
            <Server className="w-8 h-8 text-primary" />
            SN Report Tool
          </h1>
            <p className="text-muted-foreground font-mono text-sm">
            IT Operations // Diagnostic Panel
          </p>
        </div>

        <div className="flex justify-center">
          <Link href="/reports">
            <Button variant="outline" size="sm" data-testid="button-nav-reports">
              <FileText className="w-4 h-4 mr-2" />
              Report Configurations
            </Button>
          </Link>
        </div>

        <Card className="border-border bg-card/50 backdrop-blur" data-testid="card-dashboard">
          <CardHeader className="border-b border-border/50 pb-6">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Instance Connectivity
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Verify connection to the ServiceNow Personal Development Instance before running reports.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 flex flex-col items-center space-y-6">
            {isLoadingConfig ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm font-mono" data-testid="text-instance-loading">
                <Spinner className="w-4 h-4" />
                Loading configuration...
              </div>
            ) : isConfigError ? (
              <div
                className="w-full flex items-start gap-3 px-4 py-3 rounded-md bg-destructive/10 border border-destructive/20"
                data-testid="container-config-error"
              >
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-destructive">Configuration Error</p>
                  <p className="text-xs font-mono text-muted-foreground mt-1" data-testid="text-config-error-message">
                    {(configError as Error).message ?? "SN_INSTANCE secret may not be set."}
                  </p>
                </div>
              </div>
            ) : config?.instance ? (
              <div className="w-full flex items-center gap-3 px-4 py-3 rounded-md bg-muted/40 border border-border/50" data-testid="container-instance-url">
                <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="font-mono text-sm text-foreground" data-testid="text-instance-url-static">
                  {config.instance}
                </span>
              </div>
            ) : null}

            <Button
              size="lg"
              className="w-full sm:w-auto font-mono text-base px-8 h-12"
              onClick={handleTestConnection}
              disabled={isTesting || isConfigError}
              data-testid="button-test-connection"
            >
              {isTesting ? (
                <>
                  <Spinner className="mr-2 w-4 h-4" />
                  TESTING CONNECTION...
                </>
              ) : (
                "TEST CONNECTION"
              )}
            </Button>

            {hasTested && (pingResult || pingNetworkError) && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="w-full"
                data-testid="container-ping-result"
              >
                {pingNetworkError ? (
                  <div
                    className="rounded-lg border p-4 bg-destructive/10 border-destructive/20"
                    data-testid="status-network-error"
                  >
                    <div className="flex items-start gap-4">
                      <XCircle className="w-6 h-6 text-destructive mt-0.5 shrink-0" />
                      <div className="flex-1 space-y-1">
                        <h3 className="font-semibold text-destructive" data-testid="text-status-title">
                          Request Failed
                        </h3>
                        <p className="text-sm font-mono text-muted-foreground" data-testid="text-network-error-message">
                          {pingNetworkError}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : pingResult ? (
                  <div
                    className={`rounded-lg border p-4 ${
                      pingResult.ok
                        ? "bg-green-500/10 border-green-500/20"
                        : "bg-destructive/10 border-destructive/20"
                    }`}
                    data-testid={`status-${pingResult.ok ? "success" : "error"}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="mt-0.5">
                        {pingResult.ok ? (
                          <CheckCircle2 className="w-6 h-6 text-green-500" data-testid="icon-success" />
                        ) : (
                          <XCircle className="w-6 h-6 text-destructive" data-testid="icon-error" />
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <h3
                            className={`font-semibold ${
                              pingResult.ok ? "text-green-500" : "text-destructive"
                            }`}
                            data-testid="text-status-title"
                          >
                            {pingResult.ok ? "Connection Successful" : "Connection Failed"}
                          </h3>
                          {pingResult.ok && (
                            <span
                              className="text-xs font-mono px-2 py-1 rounded bg-green-500/20 text-green-400"
                              data-testid="text-latency"
                            >
                              {pingResult.latencyMs}ms
                            </span>
                          )}
                        </div>
                        <div className="text-sm space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground font-mono w-20">HOST:</span>
                            <span className="font-mono text-foreground" data-testid="text-instance-url-result">
                              {pingResult.instance}
                            </span>
                          </div>
                          {!pingResult.ok && pingResult.error && (
                            <div className="flex items-start gap-2 mt-2">
                              <span className="text-muted-foreground font-mono w-20">ERROR:</span>
                              <span className="font-mono text-destructive" data-testid="text-error-message">
                                {pingResult.error}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </motion.div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
