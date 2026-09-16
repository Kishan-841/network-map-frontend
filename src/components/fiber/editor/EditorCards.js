'use client'

import SavePanel from './SavePanel'
import ClosureCard from './ClosureCard'
import SplitterCard from './SplitterCard'
import SplitterModal from './SplitterModal'
import TargetCard from './TargetCard'

/**
 * Everything the editor can put on top of the map: the tapped-target card, the
 * closure and splitter cards, and the save form. Each one is a bottom sheet on
 * a phone and keeps its old desktop placement from `lg` up.
 */
export default function EditorCards({
  annotations,
  containerSize,
  selectedTarget,
  onCloseTarget,
  saveOpen,
  fiber,
  draftPoints,
  coreCount,
  onSaved,
  onSaveBack,
}) {
  const { editingClosure, closureCard, splitterCard, splitterPoint } = annotations
  return (
    <>
      {/* Tapped POP / closure / building (Pan mode): compact details card. */}
      {selectedTarget && <TargetCard target={selectedTarget} onClose={onCloseTarget} />}

      {/* Tapped closure ON the draft line itself (annotate + Pan mode):
          edit its type/note or remove it from the line entirely. */}
      {editingClosure && (
        <ClosureCard
          key={editingClosure.key}
          mode="edit"
          initial={{
            code: editingClosure.ref?.code,
            kind: editingClosure.ref?.kind,
            notes: editingClosure.ref?.notes,
          }}
          splitter={
            editingClosure.ref?.splitterId
              ? {
                  ratio: editingClosure.ref.splitterRatio,
                  fiberType: editingClosure.ref.splitterFiberType,
                  location: editingClosure.ref.splitterLocation,
                }
              : null
          }
          onRemoveSplitter={annotations.handleClosureSplitterRemove}
          saving={annotations.closureSaving || annotations.splitterSaving}
          error={annotations.closureError ?? annotations.splitterError}
          onSave={annotations.handleClosureEditSave}
          onRemove={annotations.handleClosureRemove}
          onCancel={annotations.handleClosureEditCancel}
        />
      )}

      {closureCard && (
        <ClosureCard
          key={closureCard.key}
          mode="create"
          at={closureCard}
          bounds={containerSize}
          saving={annotations.closureSaving}
          error={annotations.closureError}
          onSave={annotations.handleClosureSave}
          onCancel={annotations.handleClosureCancel}
        />
      )}

      {/* A saved splitter tapped on the line: what it is, Edit, Remove. */}
      {splitterCard && (
        <SplitterCard
          key={`splitter-card-${splitterCard.key}`}
          point={splitterCard}
          saving={annotations.splitterSaving}
          error={annotations.splitterError}
          onEdit={annotations.openSplitterEditor}
          onRemove={annotations.handleSplitterCardRemove}
          onCancel={annotations.closeSplitterCard}
        />
      )}

      {splitterPoint && (
        <SplitterModal
          // Prefixed: the card behind it is keyed on the same point.
          key={`splitter-${splitterPoint.key}`}
          code={splitterPoint.ref?.code}
          initial={
            splitterPoint.ref?.splitterId
              ? {
                  ratio: splitterPoint.ref.splitterRatio,
                  fiberType: splitterPoint.ref.splitterFiberType,
                  location: splitterPoint.ref.splitterLocation,
                }
              : null
          }
          saving={annotations.splitterSaving}
          error={annotations.splitterError}
          onSave={annotations.handleSplitterSave}
          onCancel={annotations.handleSplitterCancel}
        />
      )}

      {saveOpen && (
        <SavePanel
          mode={fiber ? 'edit' : 'create'}
          fiber={fiber}
          draftPoints={draftPoints}
          coreCount={coreCount}
          onSaved={onSaved}
          onBack={onSaveBack}
        />
      )}
    </>
  )
}
