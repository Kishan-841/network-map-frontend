'use client'

import { useState } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { ImportCustomersModal } from '@/components/customers/ImportCustomersModal'
import { IconUpload } from '@/components/ui/icons'

/**
 * The place outside a building to load customers for many buildings at once.
 * One sheet, routed to each building by name — the same modal the per-building
 * upload uses, just without a pinned building.
 */
export default function CustomersPage() {
  const role = useAuthStore((s) => s.user?.role)
  const [importOpen, setImportOpen] = useState(false)

  if (role && role !== 'ADMIN') {
    return <p className="text-sm text-muted">Only an admin can import customers.</p>
  }

  return (
    <main className="mx-auto max-w-2xl">
      <PageHeader
        title="Customers"
        sub="Import subscribers for every building at once"
        action={
          <Button onClick={() => setImportOpen(true)}>
            <IconUpload className="h-4 w-4" strokeWidth={1.8} />
            Upload Excel
          </Button>
        }
      />

      <section className="mt-5 rounded-card bg-card p-5 shadow-soft">
        <h2 className="text-sm font-medium text-ink">Bulk upload for every building</h2>
        <p className="mt-1 text-sm text-muted">
          Upload one sheet and each row is added to its own building. To add customers to a single
          building instead, open that building and use its Customers section.
        </p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">
          <li>
            A <b>.xlsx</b> or <b>.csv</b> with the billing columns <b>Name</b>, <b>Mobile No.</b> and{' '}
            <b>building</b> — matched by header name, any order, extra columns ignored.
          </li>
          <li>Each row is routed by its building name; case and punctuation are ignored.</li>
          <li>
            An unknown building, a missing name, or a mobile already in that building is skipped with
            a reason — never written twice.
          </li>
          <li>When a name fits more than one building, you pick the right one before importing.</li>
          <li>
            Optional columns: <b>Wing</b>, <b>PON NUMBER</b> and <b>OLT</b>.
          </li>
          <li>
            Existing customers are matched by <b>Username</b>, otherwise by mobile. Filled cells update
            them; blank cells never erase what is stored.
          </li>
          <li>Customers missing from the sheet are listed for you, never changed.</li>
        </ul>
      </section>

      {importOpen && (
        <ImportCustomersModal onClose={() => setImportOpen(false)} onImported={() => {}} />
      )}
    </main>
  )
}
