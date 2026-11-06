"use client";

import { useEffect, useMemo, useState } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useClosures } from "@/hooks/useClosures";
import { closureKindLabel } from "@/lib/fiber/constants";
import { matchClosures } from "@/lib/fiber/closure-pick";
import SplitterForm from "@/components/fiber/SplitterForm";

/**
 * "New splitter" from the Splitters page: a splitter always goes inside a
 * closure here (it takes the closure's position), so step 1 finds the
 * closure, step 2 is the same form the closure's own drawer uses.
 * A splitter placed straight on a line is still drawn in the fiber editor.
 */
export default function NewSplitterPanel({ onSaved, onCancel }) {
  const { closures, loading } = useClosures();
  const [query, setQuery] = useState("");
  const [closure, setClosure] = useState(null);
  // The chosen closure's fibers (to offer the one feeding the splitter).
  const [detail, setDetail] = useState({ id: null, fibers: null, error: null });

  const matches = useMemo(
    () => matchClosures(closures, query),
    [closures, query],
  );

  useEffect(() => {
    if (!closure) return;
    let cancelled = false;
    apiClient
      .get(`/closures/${closure.id}`)
      .then(
        (res) =>
          !cancelled &&
          setDetail({
            id: closure.id,
            fibers: res.data.data.fibers ?? [],
            error: null,
          }),
      )
      .catch(
        (err) =>
          !cancelled &&
          setDetail({
            id: closure.id,
            fibers: null,
            error: getApiErrorMessage(err),
          }),
      );
    return () => {
      cancelled = true;
    };
  }, [closure]);

  const ready = closure && detail.id === closure.id;
  const endingFibers = (ready && detail.fibers ? detail.fibers : [])
    .filter((f) => f.role === "in")
    .map((f) => ({ id: f.id, name: f.name }));

  return (
    <div className="flex flex-col gap-4 rounded-card bg-card p-5 shadow-soft">
      {!closure ? (
        <>
          <Input
            id="new-splitter-closure"
            label="Which closure is it in?"
            placeholder="Type a closure code (e.g. JC-0012) or building"
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
          />
          {query.trim() && (
            <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-btn border border-line">
              {matches.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setClosure(c)}
                    className="flex min-h-11 w-full flex-col items-start px-3 py-2 text-left transition-colors hover:bg-paper"
                  >
                    <span className="font-mono text-sm font-bold text-ink">
                      {c.code}
                    </span>
                    <span className="text-xs font-normal text-muted">
                      {closureKindLabel(c.kind) || "No kind"} ·{" "}
                      {c.building?.buildingName ?? "No building"}
                      {c.splitters?.length
                        ? ` · ${c.splitters.length} splitter${c.splitters.length === 1 ? "" : "s"}`
                        : ""}
                    </span>
                  </button>
                </li>
              ))}
              {!matches.length && (
                <li className="px-3 py-3 text-sm font-normal text-muted">
                  {loading ? "Loading closures…" : "No closure matches that."}
                </li>
              )}
            </ul>
          )}
          <div>
            <Button
              type="button"
              variant="ghost"
              className="h-11 min-h-11"
              onClick={onCancel}
            >
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 rounded-btn bg-paper px-3 py-2">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-faint">
                Closure
              </p>
              <p className="truncate text-sm font-bold text-ink">
                <span className="font-mono">{closure.code}</span>
                {closure.building?.buildingName
                  ? ` · ${closure.building.buildingName}`
                  : ""}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="h-11 min-h-11"
              onClick={() => setClosure(null)}
            >
              Change
            </Button>
          </div>
          {!ready ? (
            <p className="text-sm font-normal text-muted">
              Loading the closure…
            </p>
          ) : detail.error ? (
            <p className="rounded-btn bg-bad-tint p-3 text-sm font-medium text-bad">
              {detail.error}
            </p>
          ) : (
            <SplitterForm
              key={closure.id}
              closureId={closure.id}
              endingFibers={endingFibers}
              onSaved={onSaved}
              onCancel={onCancel}
            />
          )}
        </>
      )}
    </div>
  );
}
