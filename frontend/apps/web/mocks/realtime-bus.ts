type Listener = (body: unknown) => void;
const listeners = new Map<string, Set<Listener>>();

export function subscribe(destination: string, listener: Listener): () => void {
  const set = listeners.get(destination) ?? new Set<Listener>();
  set.add(listener);
  listeners.set(destination, set);
  return () => {
    set.delete(listener);
  };
}
export function emit(destination: string, body: unknown) {
  listeners.get(destination)?.forEach((listener) => listener(body));
}
