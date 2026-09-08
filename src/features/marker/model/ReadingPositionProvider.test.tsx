import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  ReadingPositionProvider,
  useReadingPosition,
} from "./ReadingPositionProvider";

function MovementState() {
  const { hasReaderMoved } = useReadingPosition();
  return <output>{hasReaderMoved ? "reader" : "automatic"}</output>;
}

describe("ReadingPositionProvider movement qualification", () => {
  it("does not treat a programmatic scroll as reader movement", () => {
    render(
      <ReadingPositionProvider sections={[]}>
        <MovementState />
      </ReadingPositionProvider>,
    );

    fireEvent.scroll(window);
    expect(screen.getByText("automatic")).not.toBeNull();
  });

  it("recognizes scroll following a reader wheel gesture", () => {
    render(
      <ReadingPositionProvider sections={[]}>
        <MovementState />
      </ReadingPositionProvider>,
    );

    fireEvent.wheel(window);
    fireEvent.scroll(window);
    expect(screen.getByText("reader")).not.toBeNull();
  });
});
