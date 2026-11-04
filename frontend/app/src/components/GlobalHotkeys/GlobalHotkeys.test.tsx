/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { GlobalHotkeys } from "./GlobalHotkeys"

describe("GlobalHotkeys", () => {
  it("calls handlers for configured key presses", async () => {
    const user = userEvent.setup()
    const onKeyDown = vi.fn()
    const onKeyUp = vi.fn()
    render(
      <GlobalHotkeys keyName="r,esc" onKeyDown={onKeyDown} onKeyUp={onKeyUp}>
        <div>content</div>
      </GlobalHotkeys>
    )

    await user.keyboard("r{Escape}")

    expect(onKeyDown.mock.calls.map(call => call[0])).toEqual(["r", "esc"])
    expect(onKeyUp.mock.calls.map(call => call[0])).toEqual(["r", "esc"])
  })

  it.each([
    ["Meta", "{Meta>}c{/Meta}"],
    ["Control", "{Control>}c{/Control}"],
    ["Alt", "{Alt>}c{/Alt}"],
  ])(
    "ignores %s chords and their keyup events",
    async (_modifier, sequence) => {
      const user = userEvent.setup()
      const onKeyDown = vi.fn()
      const onKeyUp = vi.fn()
      render(
        <GlobalHotkeys keyName="c" onKeyDown={onKeyDown} onKeyUp={onKeyUp}>
          <div>content</div>
        </GlobalHotkeys>
      )

      await user.keyboard(sequence)

      expect(onKeyDown).not.toHaveBeenCalled()
      expect(onKeyUp).not.toHaveBeenCalled()
    }
  )

  it("ignores repeat keydown events", () => {
    const onKeyDown = vi.fn()
    render(
      <GlobalHotkeys keyName="c" onKeyDown={onKeyDown}>
        <div>content</div>
      </GlobalHotkeys>
    )

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "c", repeat: true, bubbles: true })
    )

    expect(onKeyDown).not.toHaveBeenCalled()
  })

  it.each(["keydown", "keyup"] as const)(
    "ignores %s events without a string key",
    eventType => {
      const onKeyDown = vi.fn()
      const onKeyUp = vi.fn()
      render(
        <GlobalHotkeys keyName="c" onKeyDown={onKeyDown} onKeyUp={onKeyUp}>
          <div>content</div>
        </GlobalHotkeys>
      )

      const listenerErrors: unknown[] = []
      const onError = (event: ErrorEvent): void => {
        listenerErrors.push(event.error)
        event.preventDefault()
      }
      // jsdom reports throwing listeners as window `error` events instead of
      // throwing from `dispatchEvent`.
      window.addEventListener("error", onError)
      try {
        document.dispatchEvent(new Event(eventType))
      } finally {
        window.removeEventListener("error", onError)
      }

      expect(listenerErrors).toEqual([])
      expect(onKeyDown).not.toHaveBeenCalled()
      expect(onKeyUp).not.toHaveBeenCalled()
    }
  )

  it("removes document listeners on unmount", async () => {
    const user = userEvent.setup()
    const onKeyDown = vi.fn()
    const { unmount } = render(
      <GlobalHotkeys keyName="r" onKeyDown={onKeyDown}>
        <div>content</div>
      </GlobalHotkeys>
    )

    unmount()
    await user.keyboard("r")

    expect(onKeyDown).not.toHaveBeenCalled()
  })

  it("still fires letter shortcuts when Shift is held", async () => {
    const user = userEvent.setup()
    const onKeyDown = vi.fn()
    render(
      <GlobalHotkeys keyName="r,c" onKeyDown={onKeyDown}>
        <div>content</div>
      </GlobalHotkeys>
    )

    await user.keyboard("{Shift>}r{/Shift}")

    expect(onKeyDown).toHaveBeenCalledWith("r", expect.any(KeyboardEvent))
  })

  it("does not fire multi-character shortcuts when Shift is held", async () => {
    const user = userEvent.setup()
    const onKeyDown = vi.fn()
    render(
      <GlobalHotkeys keyName="esc" onKeyDown={onKeyDown}>
        <div>content</div>
      </GlobalHotkeys>
    )

    await user.keyboard("{Shift>}{Escape}{/Shift}")

    expect(onKeyDown).not.toHaveBeenCalled()
  })

  it("suppresses duplicate keydowns until keyup or window blur", () => {
    const onKeyDown = vi.fn()
    render(
      <GlobalHotkeys keyName="r" onKeyDown={onKeyDown}>
        <div>content</div>
      </GlobalHotkeys>
    )

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "r", bubbles: true })
    )
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "r", bubbles: true })
    )
    expect(onKeyDown).toHaveBeenCalledOnce()

    window.dispatchEvent(new Event("blur"))
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "r", bubbles: true })
    )
    expect(onKeyDown).toHaveBeenCalledTimes(2)
  })

  it("ignores key presses from editable elements", async () => {
    const user = userEvent.setup()
    const onKeyDown = vi.fn()
    render(
      <GlobalHotkeys keyName="a" onKeyDown={onKeyDown}>
        <input aria-label="editor" />
      </GlobalHotkeys>
    )

    await user.type(screen.getByLabelText("editor"), "a")

    expect(onKeyDown).not.toHaveBeenCalled()
  })

  it.each(["r", "c"])(
    "ignores %s when a custom component prevents the default",
    key => {
      const onKeyDown = vi.fn()
      const onKeyUp = vi.fn()

      render(
        <GlobalHotkeys keyName="r,c" onKeyDown={onKeyDown} onKeyUp={onKeyUp}>
          <button
            aria-label="Custom widget"
            data-testid="custom-widget"
            onKeyDown={event => event.preventDefault()}
          />
        </GlobalHotkeys>
      )

      const widget = screen.getByTestId("custom-widget")
      widget.focus()

      const event = new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
      })

      widget.dispatchEvent(event)
      widget.dispatchEvent(
        new KeyboardEvent("keyup", {
          key,
          bubbles: true,
          cancelable: true,
        })
      )

      expect(event.defaultPrevented).toBe(true)
      expect(onKeyDown).not.toHaveBeenCalled()
      expect(onKeyUp).not.toHaveBeenCalled()
    }
  )

  it.each(["r", "c"])(
    "ignores %s inside a focusable custom region",
    async key => {
      const user = userEvent.setup()
      const onKeyDown = vi.fn()
      const onKeyUp = vi.fn()
      render(
        <GlobalHotkeys
          keyName="r,c,esc"
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
        >
          <main data-testid="main-region">
            <div data-testid="custom-region">
              <span>Custom widget</span>
            </div>
            <button>Native button</button>
          </main>
        </GlobalHotkeys>
      )
      const region = screen.getByTestId("custom-region")
      screen.getByTestId("main-region").tabIndex = 0
      region.tabIndex = 0
      region.focus()
      await user.keyboard(key)
      expect(onKeyDown).not.toHaveBeenCalled()
      expect(onKeyUp).not.toHaveBeenCalled()

      await user.keyboard("{Escape}")
      expect(onKeyDown).toHaveBeenCalledWith("esc", expect.any(KeyboardEvent))
      expect(onKeyUp).toHaveBeenCalledWith("esc", expect.any(KeyboardEvent))

      onKeyDown.mockClear()
      onKeyUp.mockClear()
      screen.getByRole("button").focus()
      await user.keyboard(key)
      expect(onKeyDown).toHaveBeenCalledWith(key, expect.any(KeyboardEvent))
      expect(onKeyUp).toHaveBeenCalledWith(key, expect.any(KeyboardEvent))
    }
  )

  it("ignores keys from descendants of a focusable custom region", async () => {
    const user = userEvent.setup()
    const onKeyDown = vi.fn()
    render(
      <GlobalHotkeys keyName="r,c" onKeyDown={onKeyDown}>
        <div data-testid="custom-region">
          <button>Nested control</button>
        </div>
      </GlobalHotkeys>
    )
    screen.getByTestId("custom-region").tabIndex = 0
    screen.getByRole("button").focus()
    await user.keyboard("rc")
    expect(onKeyDown).not.toHaveBeenCalled()
  })
})
