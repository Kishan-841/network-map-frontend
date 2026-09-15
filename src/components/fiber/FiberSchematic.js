'use client'

import { useMemo } from 'react'
import { ReactFlow, Background, Handle, Position } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { buildGraph, layoutGraph } from '@/lib/fiber/schematic'
import { POINT_COLORS } from '@/lib/fiber/constants'

const EDGE_LABEL_STYLE = { fill: 'var(--color-muted)', fontSize: 11, fontWeight: 500 }

function pointKind(point) {
  return point.type === 'CLOSURE' && point.splitter ? 'SPLITTER' : point.type
}

function pointLabel(point) {
  if (point.type !== 'CLOSURE') return point.label
  if (point.splitter) return `${point.label} · ${point.splitter}`
  if (point.kind) return `${point.label} · ${point.kind}`
  return point.label
}

function FiberNode({ data }) {
  const { point } = data
  return (
    <div className="relative h-16 w-[180px] overflow-hidden rounded-btn border border-line bg-card px-3 py-2 shadow-soft">
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: POINT_COLORS[pointKind(point)] }} />
      <p className="truncate text-sm font-bold">{pointLabel(point)}</p>
      <p className="truncate font-mono text-[11px] text-muted">
        {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
      </p>
      <Handle type="source" position={Position.Right} className="!opacity-0" />
    </div>
  )
}

function FiberLinkNode({ data }) {
  return (
    <div className="relative">
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <button
        type="button"
        onClick={() => data.onFiberLink?.(data.fiber.id)}
        className="rounded-full bg-fiber-tint px-3 py-1.5 text-sm font-medium text-fiber"
      >
        {data.fiber.name} →
      </button>
      <Handle type="source" position={Position.Right} className="!opacity-0" />
    </div>
  )
}

function BuildingLinkNode({ data }) {
  return (
    <div className="relative">
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <div className="rounded-full bg-paper px-3 py-1.5 text-sm font-medium text-muted">{data.building.buildingName}</div>
      <Handle type="source" position={Position.Right} className="!opacity-0" />
    </div>
  )
}

// Module-level so React Flow never sees a fresh nodeTypes object on re-render.
const nodeTypes = { fiberNode: FiberNode, fiberLink: FiberLinkNode, buildingLink: BuildingLinkNode }

/**
 * Auto-drawn fiber schematic — a left-to-right dagre layout of a fiber's
 * points/splitters/links via React Flow. Loaded with next/dynamic({ ssr:
 * false }) by the fiber detail panel (Task C3), so nothing here may touch
 * `window` at module scope.
 */
export default function FiberSchematic({ fiber, onNodeClick, onFiberLink }) {
  const { nodes: rawNodes, edges } = useMemo(() => {
    if (!fiber) return { nodes: [], edges: [] }
    const graph = buildGraph(fiber)
    return {
      nodes: layoutGraph(graph.nodes, graph.edges),
      edges: graph.edges.map((e) => ({ ...e, type: 'smoothstep', labelStyle: EDGE_LABEL_STYLE })),
    }
  }, [fiber])

  const nodes = useMemo(
    () => rawNodes.map((n) => (n.type === 'fiberLink' ? { ...n, data: { ...n.data, onFiberLink } } : n)),
    [rawNodes, onFiberLink]
  )

  if (!fiber) return null

  return (
    <div className="h-64 w-full overflow-hidden rounded-card border border-line lg:h-72">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnScroll={false}
        panOnDrag
        proOptions={{ hideAttribution: true }}
        onNodeClick={(e, node) => node.type === 'fiberNode' && onNodeClick?.(node.data.point)}
      >
        <Background gap={16} />
      </ReactFlow>
    </div>
  )
}
