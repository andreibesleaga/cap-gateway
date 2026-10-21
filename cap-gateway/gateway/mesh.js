import cote from 'cote';
import { HTTP_CODE, SERVICE_TIMEOUT } from './constants.js';

export const createRequester = name => new cote.Requester({ name, timeout: SERVICE_TIMEOUT });

// Responders currently connected to a requester. cote 1.2.0 (final release) exposes no public API for this;
// `sock.socks` is the list of open TCP connections of its axon request socket.
export const connectedResponders = requester => requester?.sock?.socks?.length ?? 0;

/**
 * Sends a message to one responder. Resolves { reply } or { status, error } for mesh failures:
 * 503 when no responder is connected (fails fast, nothing is queued), 504 when none replied in time.
 */
export async function sendToMesh(requester, message) {
  if (connectedResponders(requester) === 0) {
    return { status: HTTP_CODE.ServiceUnavailable, error: 'No translation responder available' };
  }
  try {
    return { reply: await requester.send(message) };
  } catch (error) {
    return error?.message === 'Request timed out.'
      ? { status: HTTP_CODE.GatewayTimeout, error: `No responder replied within ${requester.timeout} ms` }
      : { status: HTTP_CODE.ServerError, error: 'Mesh request failed' };
  }
}
