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
    const closurePoint = typed.find((p) => p.closureId === s.closure.id)
    // Should not happen, but a splitter whose closure isn't on this fiber has
    // no source node to draw from — skip its outputs rather than emit a
    // dangling edge.
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
