"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock, LockOpen } from "lucide-react";

// Edit/Delete stay hidden behind a padlock, locked by default on every page
// load — a deliberate unlock click before either action is available, so a
// stray click on a list of pages/silos can't delete or edit one by
// accident. Purely client-side state, not persisted: it always starts
// locked again on refresh.
export function LockedRowActions({
  editHref,
  deleteAction,
  deleteId,
  deleteFields,
}: {
  editHref: string;
  deleteAction: (formData: FormData) => void | Promise<void>;
  // The row's numeric id, sent as the form field "id"...
  deleteId?: number;
  // ...or any other hidden fields the delete action needs (e.g. a site id
  // plus a silo's uid, for configuration rows that have no numeric id).
  deleteFields?: Record<string, string>;
}) {
  const [unlocked, setUnlocked] = useState(false);

  return (
    <div className="flex shrink-0 items-center gap-3">
      {unlocked && (
        <>
          <Link
            href={editHref}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
          >
            Edit
          </Link>
          <form action={deleteAction}>
            {deleteId !== undefined && <input type="hidden" name="id" value={deleteId} />}
            {Object.entries(deleteFields ?? {}).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <button
              type="submit"
              className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400"
            >
              Delete
            </button>
          </form>
        </>
      )}
      <button
        type="button"
        onClick={() => setUnlocked((v) => !v)}
        className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
        aria-label={unlocked ? "Lock row" : "Unlock to edit or delete"}
        title={unlocked ? "Lock" : "Unlock to edit or delete"}
      >
        {unlocked ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
      </button>
    </div>
  );
}
