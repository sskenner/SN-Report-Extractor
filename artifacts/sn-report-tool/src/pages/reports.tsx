import { useState } from "react";
import { Link } from "wouter";
import {
  useListReports,
  useCreateReport,
  useUpdateReport,
  useDeleteReport,
  useVerifyReport,
  getListReportsQueryKey,
} from "@workspace/api-client-react";
import type { ReportConfig } from "@workspace/api-client-react";
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
} from "lucide-react";
import { motion } from "framer-motion";

type FormState = {
  name: string;
  sysId: string;
  filterQuery: string;
  fields: string;
};

const EMPTY_FORM: FormState = { name: "", sysId: "", filterQuery: "", fields: "" };

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
          className="border-t border-border px-4 py-3 bg-muted/20 space-y-2 text-xs font-mono"
          data-testid={`container-expanded-${report.id}`}
        >
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
