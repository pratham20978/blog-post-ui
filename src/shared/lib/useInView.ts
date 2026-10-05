import { useEffect, useEffectEvent, useState, type RefObject } from "react";

export interface IntersectionOptions {
  /** The scroll container to measure against. Defaults to the viewport. */
  root?: RefObject<Element | null>;
  /** Grows the root, e.g. `"0px 0px 240px 0px"` to fire before the element arrives. */
  rootMargin?: string;
  /** Stop observing after the first time the element intersects. */
  once?: boolean;
}

/**
 * Calls `onChange` from an IntersectionObserver whenever the element enters or
 * leaves the root.
 *
 * Returns a callback ref rather than taking a ref object, so the observer
 * follows the element: one rendered conditionally is observed whenever it
 * exists and released when it does not.
 *
 * The callback runs from the observer — an external event, like a click — so
 * it may set state freely, which an effect body may not.
 */
export function useIntersection<T extends Element>(
  onChange: (entry: IntersectionObserverEntry) => void,
  { root, rootMargin = "0px", once = false }: IntersectionOptions = {},
): (node: T | null) => void {
  const [node, setNode] = useState<T | null>(null);
  const handle = useEffectEvent(onChange);

  useEffect(() => {
    // Every supported browser has it. Without it nothing fires, and callers
    // keep a visible control as the way forward.
    if (!node || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          handle(entry);
          if (once && entry.isIntersecting) observer.disconnect();
        }
      },
      { root: root?.current ?? null, rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, root, rootMargin, once]);

  return setNode;
}

/** Whether the element is within the root (and its margin). With `once`, it
 *  stays true after the first sighting — for loading something lazily. */
export function useInView<T extends Element>(
  options: IntersectionOptions = {},
): [(node: T | null) => void, boolean] {
  const [inView, setInView] = useState(false);
  const ref = useIntersection<T>((entry) => setInView(entry.isIntersecting), options);
  return [ref, inView];
}
