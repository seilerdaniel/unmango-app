import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import VirtualizedList from '../VirtualizedList'

describe('VirtualizedList', () => {
  const items = Array.from({ length: 200 }, (_, i) => `item-${i}`)

  it('renderiza solo la ventana visible (+ overscan), no todos los ítems', () => {
    render(
      <VirtualizedList
        items={items}
        heightPx={300}
        estimatedItemHeight={30}
        overscan={2}
        itemKey={(item) => item}
        renderRow={(item) => <div>{item}</div>}
      />
    )
    // 300px / 30px = 10 filas + 4 de overscan (2 arriba + 2 abajo).
    const rendered = screen.getAllByText(/^item-\d+$/)
    expect(rendered.length).toBeLessThan(50)
    expect(rendered.length).toBeGreaterThan(0)
    // El primer ítem visible no es necesariamente el índice 0 → se ve que se "saltó".
  })

  it('al hacer scroll la ventana se desplaza hacia los ítems siguientes', () => {
    const { container } = render(
      <VirtualizedList
        items={items}
        heightPx={300}
        estimatedItemHeight={30}
        overscan={2}
        itemKey={(item) => item}
        renderRow={(item) => <div>{item}</div>}
      />
    )
    const scroller = container.querySelector('.overflow-y-auto') as HTMLElement
    expect(scroller).not.toBeNull()
    // Scroll a ~50 filas.
    fireEvent.scroll(scroller, { target: { scrollTop: 1500 } })
    const rendered = screen.getAllByText(/^item-\d+$/)
    const indices = rendered.map((el) => Number(el.textContent!.replace('item-', '')))
    // Debe haber ítems por alrededor de la zona 50+ (mitad de 200).
    expect(indices.some((i) => i >= 40 && i <= 60)).toBe(true)
  })
})