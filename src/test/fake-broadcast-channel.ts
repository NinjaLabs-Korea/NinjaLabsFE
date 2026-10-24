/** In-process BroadcastChannel: delivers to every other open instance with the same name, never to the sender. */
export class FakeBroadcastChannel extends EventTarget {
  static instances: FakeBroadcastChannel[] = [];
  closed = false;
  constructor(readonly name: string) {
    super();
    FakeBroadcastChannel.instances.push(this);
  }
  postMessage(data: unknown) {
    for (const other of FakeBroadcastChannel.instances) {
      if (other !== this && !other.closed && other.name === this.name) other.dispatchEvent(new MessageEvent("message", { data }));
    }
  }
  close() {
    this.closed = true;
  }
}
