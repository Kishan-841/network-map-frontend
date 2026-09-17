'use client'

import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { RATIO_LABELS } from '@/lib/fiber/constants'

/**
 * Picks the splitter output a new fiber starts from. Free outputs are
 * enabled pills; used ones show what already occupies them and are disabled.
 */
export default function SplitterStartDialog({ closure, splitters, onPick, onClose }) {
  return (
    <Modal
      open
      onClose={onClose}
      title={`Start from ${closure.code}`}
      footer={
        <Button type="button" variant="secondary" fullWidth onClick={onClose}>
          Cancel
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {splitters.length === 0 && <p className="text-sm text-muted">No splitters on this closure.</p>}
        {splitters.map((splitter) => (
          <div key={splitter.id}>
            <p className="mb-2 text-sm font-medium text-muted">
              {RATIO_LABELS[splitter.ratio] ?? splitter.ratio}
              {splitter.location ? ` · ${splitter.location}` : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              {splitter.outputs.map((output) => {
                const usedBy = output.toFiber?.name ?? output.toBuilding?.buildingName ?? null
                return (
                  <button
                    key={output.portNo}
                    type="button"
                    disabled={Boolean(usedBy)}
                    onClick={() => onPick({ splitterId: splitter.id, portNo: output.portNo })}
                    className={`min-h-11 rounded-full px-3.5 text-sm font-medium transition-colors ${
                      usedBy
                        ? 'cursor-not-allowed bg-paper text-faint'
                        : 'bg-fiber-tint text-fiber hover:bg-fiber/20'
                    }`}
                  >
                    {usedBy ? `Out ${output.portNo} → ${usedBy}` : `Out ${output.portNo}`}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}
