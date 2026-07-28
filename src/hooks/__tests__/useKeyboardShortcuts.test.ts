import { describe, it, expect } from 'vitest'
import { shouldIgnoreShortcut } from '../useKeyboardShortcuts'

describe('shouldIgnoreShortcut', () => {
  it('ignora el atajo si el foco está en un input', () => {
    const input = document.createElement('input')
    expect(shouldIgnoreShortcut(input)).toBe(true)
  })

  it('ignora el atajo si el foco está en un textarea', () => {
    const textarea = document.createElement('textarea')
    expect(shouldIgnoreShortcut(textarea)).toBe(true)
  })

  it('ignora el atajo si el foco está en un select', () => {
    const select = document.createElement('select')
    expect(shouldIgnoreShortcut(select)).toBe(true)
  })

  it('ignora el atajo si el foco está en un elemento contenteditable', () => {
    const div = document.createElement('div')
    div.setAttribute('contenteditable', 'true')
    expect(shouldIgnoreShortcut(div)).toBe(true)
  })

  it('NO ignora el atajo si el foco está en un botón o el body', () => {
    const button = document.createElement('button')
    expect(shouldIgnoreShortcut(button)).toBe(false)
    expect(shouldIgnoreShortcut(document.body)).toBe(false)
  })

  it('no rompe si el target es null', () => {
    expect(shouldIgnoreShortcut(null)).toBe(false)
  })
})
