import { HTTP_CODE } from './constants.js';

// Normalises any thrown value into the { error } body returned to clients
export const getError = error => ({
  error: error?.response?.data ?? error?.response?.message ?? error?.message ?? error?.response,
});

// Sends a responder reply: either its { error, status } envelope or the payload as is
export const sendServiceReply = (res, reply) =>
  reply?.status !== undefined && reply?.error !== undefined
    ? res.status(reply.status).json({ error: reply.error })
    : res.send(reply);

// Sends a gateway-side failure (responder timeout, no responder, ...)
export const sendFailure = (res, error) =>
  res.status(error?.response?.status ?? HTTP_CODE.ServerError).json(getError(error));
