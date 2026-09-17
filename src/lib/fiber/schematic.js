import dagre from '@dagrejs/dagre'

/**
 * Pure graph builder for the fiber schematic (Task C2). Kept free of React
 * and @xyflow/react so it is trivially unit-testable — see
 * src/lib/fiber/__tests__/schematic.test.js.
 *
 * Node/edge shapes intentionally mirror @xyflow/react's expectations
 * (id, type, data, position, source/targetPosition) without importing it.
 */

const W = 180
const H = 64

const RATIO_LABELS = { R1_2: '1:2', R1_4: '1:4', R1_6: '1:6', R1_8: '1:8', R1_16: '1:16' }
const FIBER_TYPE_LABELS = { MAIN: 'Main', SUB: 'Sub' }

/**
 * What a node says. A splitter carries everything that distinguishes it —
 * `S1 · 1:4 · Main · S2`; a closure adds its splitter's ratio or its own kind.
 */
export function nodeLabel(point) {
  if (point.type === 'SPLITTER') {
    const ratio = point.splitter ?? RATIO_LABELS[point.splitterRatio]
    return [point.label, ratio, FIBER_TYPE_LABELS[point.splitterFiberType], point.splitterLocation]
      .filter(Boolean)
      .join(' · ')
  }
  if (point.type !== 'CLOSURE') return point.label
  if (point.splitter) return `${point.label} · ${point.splitter}`
  if (point.kind) return `${point.label} · ${point.kind}`
  return point.label
}

/** Builds fiberNode/fiberLink/buildingLink nodes and edges from a `GET /fibers/:id` payload. */
export function buildGraph(fiber) {
  const typed = fiber.points.filter((p) => p.type !== 'WAYPOINT')

  const nodes = typed.map((p) => ({
    id: p.id,
    type: 'fiberNode',
    data: { point: p },
  }))

  const edges = typed.slice(1).map((p, i) => ({
    id: `e${i}`,
    source: typed[i].id,
    target: p.id,
    label: `${Math.round(fiber.segments[i]?.mapMeters ?? 0)} m`,
  }))

  for (const s of fiber.splitters ?? []) {
    // A splitter sits either on a closure of this line or on a point of its
    // own. Either way it needs a node here to draw its outputs from; one whose
    // home isn't on this fiber is skipped rather than left dangling.
    const closurePoint = s.closure?.id
      ? typed.find((p) => p.closureId === s.closure.id)
      : typed.find((p) => p.splitterId === s.id)
    if (!closurePoint) continue

    for (const o of s.outputs) {
      if (o.toFiber) {
        nodes.push({ id: `f-${o.toFiber.id}`, type: 'fiberLink', data: { fiber: o.toFiber, portNo: o.portNo } })
        edges.push({ id: `es-${o.id}`, source: closurePoint.id, target: `f-${o.toFiber.id}`, label: `out ${o.portNo}` })
      } else if (o.toBuilding) {
        nodes.push({ id: `b-${s.id}-${o.portNo}`, type: 'buildingLink', data: { building: o.toBuilding, portNo: o.portNo } })
        edges.push({ id: `eb-${o.id}`, source: closurePoint.id, target: `b-${s.id}-${o.portNo}`, label: `out ${o.portNo}` })
      }
    }
  }

  return { nodes, edges }
}

/** Lays out nodes left-to-right with dagre, returning them with position + handle sides set. */
export function layoutGraph(nodes, edges) {
  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', nodesep: 24, ranksep: 48 })
  nodes.forEach((n) => g.setNode(n.id, { width: W, height: H }))
  edges.forEach((e) => g.setEdge(e.source, e.target))
  dagre.layout(g)

  return nodes.map((n) => ({
    ...n,
    position: { x: g.node(n.id).x - W / 2, y: g.node(n.id).y - H / 2 },
    sourcePosition: 'right',
    targetPosition: 'left',
  }))
}
