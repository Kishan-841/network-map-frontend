'use client'

import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { IconPlus, IconTrash } from '@/components/ui/icons'
import { FMS_PORT_COUNTS, OLT_TYPES, SWITCH_SPEEDS } from '@/lib/fiber/pop-sheet'

/**
 * The rack's contents, edited inside the POP form rather than after saving it.
 *
 * Nothing here calls the API: the rows live in the form's state and go up with
 * the POP in one request, so a new POP and its equipment are recorded in a
 * single save and a half-filled form leaves nothing behind. A row that came
 * from the server keeps its `id` — that is what tells the API to keep it
 * rather than replace it.
 */
const DEVICE_KINDS = [
  // `speed` is a switch's alone; a model number is worth having on anything
  // with a label on the front, which is everything except a passive FMS.
  { kind: 'SWITCH', label: 'Switch', plural: 'Switches', needs: 'ip', speed: true, model: true },
  { kind: 'MIKROTIK', label: 'Mikrotik', plural: 'Mikrotiks', needs: 'ip', model: true },
  { kind: 'FMS', label: 'FMS', plural: 'FMS units', needs: 'ports' },
]

function RowShell({ children, onRemove, removeLabel, columns = 3 }) {
  const grid = { 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4', 5: 'sm:grid-cols-2 lg:grid-cols-5' }[columns]
  return (
    <div className="flex items-end gap-2">
      <div className={`grid flex-1 grid-cols-1 gap-2 ${grid}`}>{children}</div>
      <button
        type="button"
        aria-label={removeLabel}
        onClick={onRemove}
        className="mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-btn text-muted transition-colors hover:bg-bad-tint hover:text-bad"
      >
        <IconTrash className="h-4 w-4" strokeWidth={1.8} />
      </button>
    </div>
  )
}

function AddRowButton({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 w-fit items-center gap-2 rounded-btn border border-line bg-card px-3 text-sm font-medium transition-colors hover:border-fiber/50"
    >
      <IconPlus className="h-4 w-4" strokeWidth={1.8} />
      Add {label}
    </button>
  )
}

function Section({ title, children }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-faint">{title}</p>
      {children}
    </div>
  )
}

export function PopEquipmentFields({ olts, devices, onChange, errors = { olts: [], devices: [] } }) {
  const setOlts = (next) => onChange({ olts: next, devices })
  const setDevices = (next) => onChange({ olts, devices: next })

  // Rows are matched by position: they have no id until they have been saved.
  const patchAt = (list, index, patch) => list.map((row, i) => (i === index ? { ...row, ...patch } : row))
  const removeAt = (list, index) => list.filter((_, i) => i !== index)

  return (
    <div className="flex flex-col gap-4 rounded-btn border border-line bg-paper p-3">
      <Section title="OLTs">
        {olts.length === 0 && <p className="text-sm font-normal text-muted">None yet.</p>}
        {olts.map((olt, index) => (
          <RowShell
            key={olt.id ?? `new-olt-${index}`}
            removeLabel={`Remove OLT ${index + 1}`}
            columns={5}
            onRemove={() => setOlts(removeAt(olts, index))}
          >
            <Input
              id={`olt-name-${index}`}
              placeholder="OLT name e.g. OLT-1"
              value={olt.name ?? ''}
              error={errors.olts?.[index]?.name}
              onChange={(e) => setOlts(patchAt(olts, index, { name: e.target.value }))}
            />
            <Input
              id={`olt-ports-${index}`}
              type="number"
              min={1}
              max={256}
              placeholder="PON ports"
              value={olt.ponPortCount ?? ''}
              error={errors.olts?.[index]?.ponPortCount}
              onChange={(e) => setOlts(patchAt(olts, index, { ponPortCount: e.target.value }))}
            />
            <Input
              id={`olt-ip-${index}`}
              placeholder="IP e.g. 10.0.1.1"
              value={olt.ipAddress ?? ''}
              error={errors.olts?.[index]?.ipAddress}
              onChange={(e) => setOlts(patchAt(olts, index, { ipAddress: e.target.value }))}
            />
            <Select
              id={`olt-type-${index}`}
              value={olt.type ?? ''}
              onChange={(e) => setOlts(patchAt(olts, index, { type: e.target.value }))}
            >
              <option value="">Type — not recorded</option>
              {OLT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
            <Input
              id={`olt-model-${index}`}
              placeholder="Model no e.g. C320"
              value={olt.model ?? ''}
              onChange={(e) => setOlts(patchAt(olts, index, { model: e.target.value }))}
            />
          </RowShell>
        ))}
        <AddRowButton
          label="OLT"
          onClick={() => setOlts([...olts, { name: '', ponPortCount: 8, ipAddress: '' }])}
        />
      </Section>

      {DEVICE_KINDS.map(({ kind, label, plural, needs, speed: hasSpeed, model: hasModel }) => {
        // Indices are into the whole device list, so an edit lands on the right row.
        const mine = devices.map((device, index) => ({ device, index })).filter((d) => d.device.kind === kind)
        return (
          <Section key={kind} title={plural}>
            {mine.length === 0 && <p className="text-sm font-normal text-muted">None yet.</p>}
            {mine.map(({ device, index }, nth) => (
              <RowShell
                key={device.id ?? `new-${kind}-${index}`}
                removeLabel={`Remove ${label} ${nth + 1}`}
                columns={2 + (hasSpeed ? 1 : 0) + (hasModel ? 1 : 0)}
                onRemove={() => setDevices(removeAt(devices, index))}
              >
                <Input
                  id={`device-label-${kind}-${nth}`}
                  placeholder={`Name — optional e.g. ${label} 1`}
                  value={device.label ?? ''}
                  onChange={(e) => setDevices(patchAt(devices, index, { label: e.target.value }))}
                />
                {hasSpeed && (
                  <Select
                    id={`device-speed-${kind}-${nth}`}
                    value={device.speed ?? ''}
                    onChange={(e) => setDevices(patchAt(devices, index, { speed: e.target.value }))}
                  >
                    <option value="">Speed — not recorded</option>
                    {SWITCH_SPEEDS.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </Select>
                )}
                {hasModel && (
                  <Input
                    id={`device-model-${kind}-${nth}`}
                    placeholder="Model no"
                    value={device.model ?? ''}
                    onChange={(e) => setDevices(patchAt(devices, index, { model: e.target.value }))}
                  />
                )}
                {needs === 'ip' ? (
                  <Input
                    id={`device-ip-${kind}-${nth}`}
                    placeholder="IP e.g. 10.0.0.1"
                    value={device.ipAddress ?? ''}
                    error={errors.devices?.[index]?.ipAddress}
                    onChange={(e) => setDevices(patchAt(devices, index, { ipAddress: e.target.value }))}
                  />
                ) : (
                  <Select
                    id={`device-ports-${kind}-${nth}`}
                    value={device.portCount ?? FMS_PORT_COUNTS[0]}
                    error={errors.devices?.[index]?.portCount}
                    onChange={(e) => setDevices(patchAt(devices, index, { portCount: e.target.value }))}
                  >
                    {FMS_PORT_COUNTS.map((count) => (
                      <option key={count} value={count}>
                        {count} port
                      </option>
                    ))}
                  </Select>
                )}
              </RowShell>
            ))}
            <AddRowButton
              label={label}
              onClick={() =>
                setDevices([
                  ...devices,
                  needs === 'ip'
                    ? { kind, label: '', ipAddress: '' }
                    : { kind, label: '', portCount: FMS_PORT_COUNTS[0] },
                ])
              }
            />
          </Section>
        )
      })}
    </div>
  )
}

export { DEVICE_KINDS }
export default PopEquipmentFields
