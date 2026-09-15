import { describe, it, expect } from 'vitest'
import { buildGraph, layoutGraph } from '../schematic.js'

function baseFiber() {
  return {
    id: 'fib1',
    name: 'FIB-001',
    coreCount: 12,
    points: [
      { id: 'p0', sequence: 0, type: 'POP', latitude: 1, longitude: 1, label: 'POP A', splitter: null, closureId: null, popId: 'pop1', buildingId: null },
      { id: 'p1', sequence: 1, type: 'WAYPOINT', latitude: 1.1, longitude: 1.1, label: null, splitter: null, closureId: null, popId: null, buildingId: null },
      { id: 'p2', sequence: 2, type: 'CLOSURE', latitude: 2, longitude: 2, label: 'CL-0001', splitter: null, closureId: 'c1', popId: null, buildingId: null },
      { id: 'p3', sequence: 3, type: 'WAYPOINT', latitude: 2.5, longitude: 2.5, label: null, splitter: null, closureId: null, popId: null, buildingId: null },
      { id: 'p4', sequence: 4, type: 'BUILDING', latitude: 3, longitude: 3, label: 'Building A', splitter: null, closureId: null, popId: null, buildingId: 'bA' },
    ],
    segments: [
      { id: 's0', sequence: 0, fromPointId: 'p0', toPointId: 'p2', mapMeters: 123.4, fiberLaidMeters: 130, isCut: false },
      { id: 's1', sequence: 1, fromPointId: 'p2', toPointId: 'p4', mapMeters: 456.7, fiberLaidMeters: 460, isCut: false },
    ],
    splitters: [],
  }
}

describe('buildGraph', () => {
  it('builds fiberNode chain skipping waypoints, with rounded metre edge labels', () => {
    const { nodes, edges } = buildGraph(baseFiber())
    expect(nodes).toHaveLength(3)
    expect(nodes.map((n) => n.id)).toEqual(['p0', 'p2', 'p4'])
    expect(nodes.every((n) => n.type === 'fiberNode')).toBe(true)
    expect(edges).toHaveLength(2)
    expect(edges[0]).toMatchObject({ source: 'p0', target: 'p2', label: '123 m' })
    expect(edges[1]).toMatchObject({ source: 'p2', target: 'p4', label: '457 m' })
  })

  it('adds a fiberLink node/edge for a splitter output pointing to another fiber', () => {
    const fiber = baseFiber()
    fiber.splitters = [
      {
        id: 'sp1',
        ratio: '1:2',
        closure: { id: 'c1', code: 'CL-0001' },
        outputs: [
          { id: 'o2', portNo: 2, toFiber: { id: 'fib2', name: 'FIB-002', status: 'LIVE' }, toBuilding: null },
          { id: 'o1', portNo: 1, toFiber: null, toBuilding: { id: 'bA', buildingName: 'Building B' } },
        ],
      },
    ]
    const { nodes, edges } = buildGraph(fiber)
    expect(nodes).toHaveLength(5)

    const fiberLinkNode = nodes.find((n) => n.id === 'f-fib2')
    expect(fiberLinkNode).toMatchObject({ type: 'fiberLink', data: { fiber: { id: 'fib2', name: 'FIB-002' }, portNo: 2 } })

    const buildingLinkNode = nodes.find((n) => n.id === 'b-sp1-1')
    expect(buildingLinkNode).toMatchObject({ type: 'buildingLink', data: { portNo: 1 } })

    const fiberLinkEdge = edges.find((e) => e.target === 'f-fib2')
    expect(fiberLinkEdge).toMatchObject({ source: 'p2', label: 'out 2' })

    const buildingLinkEdge = edges.find((e) => e.target === 'b-sp1-1')
    expect(buildingLinkEdge).toMatchObject({ source: 'p2', label: 'out 1' })
  })

  it('skips splitter outputs when the closure point is not on this fiber', () => {
    const fiber = baseFiber()
    fiber.splitters = [
      {
        id: 'sp1',
        ratio: '1:2',
        closure: { id: 'not-on-fiber' },
        outputs: [{ id: 'o2', portNo: 2, toFiber: { id: 'fib2', name: 'FIB-002', status: 'LIVE' }, toBuilding: null }],
      },
    ]
    const { nodes, edges } = buildGraph(fiber)
    expect(nodes).toHaveLength(3)
    expect(edges).toHaveLength(2)
  })
})

describe('layoutGraph', () => {
  it('lays chain nodes out with strictly increasing x and numeric positions', () => {
    const { nodes, edges } = buildGraph(baseFiber())
    const laidOut = layoutGraph(nodes, edges)
    expect(laidOut).toHaveLength(3)
    for (const n of laidOut) {
      expect(typeof n.position.x).toBe('number')
      expect(typeof n.position.y).toBe('number')
      expect(Number.isNaN(n.position.x)).toBe(false)
      expect(Number.isNaN(n.position.y)).toBe(false)
    }
    const byId = Object.fromEntries(laidOut.map((n) => [n.id, n]))
    expect(byId.p0.position.x).toBeLessThan(byId.p2.position.x)
    expect(byId.p2.position.x).toBeLessThan(byId.p4.position.x)
    expect(byId.p0.sourcePosition).toBe('right')
    expect(byId.p0.targetPosition).toBe('left')
  })
})
