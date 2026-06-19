import type { NetMessage, NetType, PayloadOf } from './protocol';
import { generateRoomCode, isValidRoomCode, peerIdForCode } from './roomCode';

export type NetRole = 'host' | 'guest';
type Handler<T extends NetType> = (data: PayloadOf<T>) => void;

/**
 * Typed 1v1 transport. Wraps PeerJS WebRTC for real two-browser play, and also
 * supports an in-memory channel (`attachChannel`) used by the bot/loopback path
 * so the full duel flow runs without a signaling broker.
 */
export class DuelNet {
  role: NetRole | null = null;
  code = '';
  opened = false;

  // Stored loosely; the public on()/send() keep the per-type typing.
  private handlers: Partial<Record<NetType, (data: any) => void>> = {};
  private openCb: (() => void) | null = null;
  private closeCb: (() => void) | null = null;

  // Outbound sink: PeerJS conn.send, or a loopback delivery fn.
  private outbound: ((msg: NetMessage) => void) | null = null;
  private peer: any = null;
  private conn: any = null;

  /** Open a room; resolves with the bare 6-digit code players share. */
  async host(): Promise<string> {
    const { default: Peer } = await import('peerjs');
    this.role = 'host';
    // Retry on the rare "code already in use" so a collision in the 6-digit
    // space just picks a fresh code instead of failing the host.
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateRoomCode();
      try {
        await this.openHostPeer(Peer, peerIdForCode(code));
        this.code = code;
        return code;
      } catch (err: any) {
        if (err?.type === 'unavailable-id' && attempt < 4) continue;
        throw err instanceof Error ? err : new Error('Could not create a room.');
      }
    }
    throw new Error('Could not create a room.');
  }

  /** Bring up a host peer at a fixed id; rejects on broker timeout or taken id. */
  private openHostPeer(Peer: any, peerId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const peer = new Peer(peerId);
      this.peer = peer;
      const timer = setTimeout(() => reject(new Error('Could not reach the signaling broker.')), 12_000);
      let settled = false;
      peer.on('open', () => {
        clearTimeout(timer);
        settled = true;
        resolve();
      });
      peer.on('connection', (conn: any) => {
        this.conn = conn;
        this.outbound = (msg) => {
          try {
            conn.send(msg);
          } catch {
            /* broken pipe */
          }
        };
        conn.on('open', () => this.wire());
        conn.on('data', (raw: unknown) => this.receive(raw as NetMessage));
        conn.on('close', () => this.emitClose());
      });
      peer.on('error', (err: any) => {
        clearTimeout(timer);
        // Errors before the peer opens (e.g. taken id) — drop this peer so the
        // caller can retry cleanly; ignore post-open transient errors.
        if (!settled) {
          try {
            peer.destroy();
          } catch {
            /* ignore */
          }
          reject(err);
        }
      });
    });
  }

  async join(code: string): Promise<void> {
    if (!isValidRoomCode(code)) throw new Error('Enter a 6-digit code.');
    const { default: Peer } = await import('peerjs');
    this.role = 'guest';
    this.code = code;
    return new Promise((resolve, reject) => {
      this.peer = new Peer();
      const timer = setTimeout(() => reject(new Error('Could not reach the signaling broker.')), 12_000);
      this.peer.on('open', () => {
        const conn = this.peer.connect(peerIdForCode(code), { reliable: true });
        const joinTimer = setTimeout(() => {
          conn.close();
          reject(new Error('No host found at that code.'));
        }, 15_000);
        conn.on('open', () => {
          clearTimeout(timer);
          clearTimeout(joinTimer);
          this.conn = conn;
          this.outbound = (msg) => {
            try {
              conn.send(msg);
            } catch {
              /* broken pipe */
            }
          };
          this.wire();
          resolve();
        });
        conn.on('data', (raw: unknown) => this.receive(raw as NetMessage));
        conn.on('close', () => this.emitClose());
        conn.on('error', (err: Error) => {
          clearTimeout(joinTimer);
          reject(err);
        });
      });
      this.peer.on('error', (err: any) => {
        clearTimeout(timer);
        if (err?.type === 'peer-unavailable') reject(new Error('No host found at that code.'));
        else if (!this.opened) reject(err);
      });
    });
  }

  /** Wire an in-memory channel (bot/loopback). `sink` receives our outbound msgs. */
  attachChannel(role: NetRole, code: string, sink: (msg: NetMessage) => void) {
    this.role = role;
    this.code = code;
    this.outbound = sink;
    this.wire();
  }

  /** Deliver an inbound message (used by the loopback channel). */
  deliver(msg: NetMessage) {
    this.receive(msg);
  }

  private wire() {
    this.opened = true;
    this.openCb?.();
  }

  private receive(raw: NetMessage) {
    if (!raw || typeof raw !== 'object' || !('type' in raw)) return;
    const fn = this.handlers[raw.type];
    if (fn) fn(raw.data);
  }

  send<T extends NetType>(type: T, data: PayloadOf<T>) {
    this.outbound?.({ type, data } as NetMessage);
  }

  on<T extends NetType>(type: T, fn: Handler<T>) {
    this.handlers[type] = fn as (data: any) => void;
  }

  onOpen(fn: () => void) {
    this.openCb = fn;
  }
  onClose(fn: () => void) {
    this.closeCb = fn;
  }

  private emitClose() {
    this.opened = false;
    this.closeCb?.();
  }

  close() {
    try {
      this.send('bye', {});
    } catch {
      /* ignore */
    }
    try {
      this.conn?.close();
    } catch {
      /* ignore */
    }
    try {
      this.peer?.destroy();
    } catch {
      /* ignore */
    }
    this.conn = null;
    this.peer = null;
    this.outbound = null;
    this.opened = false;
    this.handlers = {};
  }
}
