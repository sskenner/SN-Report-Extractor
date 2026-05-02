import { useState, useEffect } from "react";
import { useServicenowPing } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Server, Activity, CheckCircle2, XCircle } from "lucide-react";
import { motion } from "framer-motion";
import { Spinner } from "@/components/ui/spinner";

export default function Home() {
  const [hasTested, setHasTested] = useState(false);

  const { data: pingResult, isLoading, isFetching, refetch } = useServicenowPing({
    query: {
      enabled: false,
    },
  });

  const handleTestConnection = () => {
    setHasTested(true);
    refetch();
  };

  const isTesting = isLoading || isFetching;

  useEffect(() => {
    document.documentElement.classList.add("dark");
    return () => document.documentElement.classList.remove("dark");
  }, []);

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
            <Button
              size="lg"
              className="w-full sm:w-auto font-mono text-base px-8 h-12"
              onClick={handleTestConnection}
              disabled={isTesting}
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

            {hasTested && pingResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="w-full"
                data-testid="container-ping-result"
              >
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
                          <span className="font-mono text-foreground" data-testid="text-instance-url">
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
              </motion.div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
