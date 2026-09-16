import { describe, it, expect } from 'vitest'
import { buildGraph, layoutGraph, nodeLabel } from '../schematic.js'

function baseFiber() {
  return {
    id: 'fib1',
    name: 'FIB-001',
    coreCount: 12,
    points: [
      { id: 'p0', sequence: 0, type: 'POP', latitude: 1, longitude: 1, label: 'POP A', splitter: null, closureId: null, popId: 'pop1', buildingId: null },
      { id: 'p1', sequence: 1, type: 'WAYPOINT', latitude: 1.1, longitude: 1.1, label: null, splitter: null, closureId: null, popId: null, buildingId: null },
      { id: 'p2', sequence: 2, type: 'CLOSURE', latitude: 2, longitude: 2, label: 'JC-0001', splitter: null, closureId: 'c1', popId: null, buildingId: null },
      { id: 'p3', sequence: 3, type: 'WAYPOINT', latitude: 2.5, longitude: 2.5, label: null, splitter: null, closureId: null, popId: null, buildingId: null },
      { id: 'p4', sequence: 4, type: 'BUILDING', latitude: 3, longitude: 3, label: 'Building A', splitter: null, closureId: null, popId: null, buildingId: 'bA' },
    ],
    segments: [
      { id: 's0', sequence: 0, fromPointId: 'p0', toPointId: 'p2', mapMeters: 123.4, isCut: false },
      { id: 's1', sequence: 1, fromPointId: 'p2', toPointId: 'p4', mapMeters: 456.7, isCut: false },
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
        closure: { id: 'c1', code: 'JC-0001' },
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

describe('a splitter that is a point on the line', () => {
  const linePoint = {
    id: 'p5',
    sequence: 5,
    type: 'SPLITTER',
    latitude: 4,
    longitude: 4,
    label: 'S1',
    splitter: '1:4',
    splitterId: 'sp9',
    splitterRatio: 'R1_4',
    splitterFiberType: 'MAIN',
    splitterLocation: 'WAN',
    closureId: null,
    popId: null,
    buildingId: null,
  }

  it('labels it with code, ratio, fiber type and location', () => {
    expect(nodeLabel(linePoint)).toBe('S1 · 1:4 · Main · WAN')
    expect(nodeLabel({ type: 'POP', label: 'POP A' })).toBe('POP A')
    expect(nodeLabel({ type: 'CLOSURE', label: 'JC-0001', kind: 'Compass' })).toBe('JC-0001 · Compass')
  })

  it('draws its outputs from its own node, not a closure', () => {
    const fiber = baseFiber()
    fiber.points.push(linePoint)
    fiber.segments.push({ id: 's2', sequence: 2, fromPointId: 'p4', toPointId: 'p5', mapMeters: 10, isCut: false })
    fiber.splitters = [
      {
        id: 'sp9',
        ratio: 'R1_4',
        closure: null,
        outputs: [{ id: 'o1', portNo: 1, toFiber: null, toBuilding: { id: 'bZ', buildingName: 'Building Z' } }],
      },
    ]
    const { nodes, edges } = buildGraph(fiber)
    expect(nodes.map((n) => n.id)).toContain('p5')
    expect(edges.find((e) => e.target === 'b-sp9-1')).toMatchObject({ source: 'p5', label: 'out 1' })
  })
})

describe('layoutGraph', () => {
  it('lays chain nodes out with strictly increasing x and numeric positions', () => {
    const { nodes, edges } = buildGraph(baseFiber())
    const positioned = layoutGraph(nodes, edges)
    expect(positioned).toHaveLength(3)
    for (const n of positioned) {
      expect(typeof n.position.x).toBe('number')
      expect(typeof n.position.y).toBe('number')
      expect(Number.isNaN(n.position.x)).toBe(false)
      expect(Number.isNaN(n.position.y)).toBe(false)
    }
    const byId = Object.fromEntries(positioned.map((n) => [n.id, n]))
    expect(byId.p0.position.x).toBeLessThan(byId.p2.position.x)
    expect(byId.p2.position.x).toBeLessThan(byId.p4.position.x)
    expect(byId.p0.sourcePosition).toBe('right')
    expect(byId.p0.targetPosition).toBe('left')
  })
})
