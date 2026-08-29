'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'

interface Props<T> {
  items: T[]
  renderRow: (item: T, index: number) => React.ReactNode
  itemKey: (item: T, index: number) => string
  estimatedItemHeight?: number
  overscan?: number
  heightPx?: number
  footer?: React.ReactNode
  emptyState?: React.ReactNode
}

function binarySearchLE(prefix: number[], target: number): number {
  let lo = 0
  let hi = prefix.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (prefix[mid] <= target) lo = mid
    else hi = mid - 1
  }
  return lo
}

export default function VirtualizedList<T>({
  items,
  renderRow,
  itemKey,
  estimatedItemHeight = 72,
  overscan = 6,
  heightPx = 560,
  footer,
  emptyState,
}: Props<T>) {
  const [heights, setHeights] = useState<number[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewport, setViewport] = useState(heightPx)

  const length = items.length

  const { prefix, total } = useMemo(() => {
    const p = new Array<number>(length + 1)
    p[0] = 0
    let sum = 0
    for (let i = 0; i < length; i++) {
      sum += heights[i] ?? estimatedItemHeight
      p[i + 1] = sum
    }
    return { prefix: p, total: sum }
  }, [length, heights, estimatedItemHeight])

  let start = binarySearchLE(prefix, scrollTop)
  start = Math.max(0, start - overscan)
  let end = start
  while (end < length && prefix[end] <= scrollTop + viewport) end++
  end = Math.min(length, end + overscan)
  const topOffset = prefix[start]

  const measureRef = (index: number) => (node: HTMLElement | null) => {
    if (!node) return
    const h = node.getBoundingClientRect().height
    if (h <= 0) return
    setHeights((prev) => {
      if (Math.abs((prev[index] ?? 0) - h) <= 0.5) return prev
      const next = prev.slice()
      next[index] = h
      return next
    })
  }

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const update = () => setViewport(el.clientHeight)
    update()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [])

  const visible: { item: T; index: number }[] = []
  for (let i = start; i < end; i++) visible.push({ item: items[i], index: i })

  return (
    <div
      ref={scrollRef}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      className="overflow-y-auto"
      style={{ maxHeight: heightPx }}
    >
      {length === 0 ? (
        <div>{emptyState}</div>
      ) : (
        <>
          <div style={{ height: total, position: 'relative' }}>
            <div style={{ position: 'absolute', top: topOffset, left: 0, right: 0 }}>
              {visible.map(({ item, index }) => (
                <div key={itemKey(item, index)} ref={measureRef(index)}>
                  {renderRow(item, index)}
                </div>
              ))}
            </div>
          </div>
          {footer}
        </>
      )}
    </div>
  )
}