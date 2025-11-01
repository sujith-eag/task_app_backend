/**
 * In-memory session registry for tracking active socket connections per user/device.
 * Note: This is an in-memory store and will be lost on process restart.
 * For production you may want to persist this in Redis or another shared store.
 */

const userMap = new Map(); // userId -> Map(deviceId -> { sockets: Set(socketId), lastSeen: Date })
const socketMap = new Map(); // socketId -> { userId, deviceId }

export const registerSocket = (userId, deviceId, socketId) => {
  if (!userId || !socketId) return;
  const dId = deviceId || 'unknown';

  let devices = userMap.get(userId);
  if (!devices) {
    devices = new Map();
    userMap.set(userId, devices);
  }

  let entry = devices.get(dId);
  if (!entry) {
    entry = { sockets: new Set(), lastSeen: new Date() };
    devices.set(dId, entry);
  }

  entry.sockets.add(socketId);
  entry.lastSeen = new Date();

  socketMap.set(socketId, { userId, deviceId: dId });
};

export const unregisterSocket = (socketId) => {
  const meta = socketMap.get(socketId);
  if (!meta) return;
  const { userId, deviceId } = meta;

  const devices = userMap.get(userId);
  if (!devices) {
    socketMap.delete(socketId);
    return;
  }

  const entry = devices.get(deviceId);
  if (entry) {
    entry.sockets.delete(socketId);
    entry.lastSeen = new Date();
    if (entry.sockets.size === 0) {
      devices.delete(deviceId);
    }
  }

  if (devices.size === 0) {
    userMap.delete(userId);
  }

  socketMap.delete(socketId);
};

export const getActiveDevicesForUser = (userId) => {
  const devices = userMap.get(userId);
  if (!devices) return [];
  const out = [];
  for (const [deviceId, entry] of devices.entries()) {
    out.push({ deviceId, socketCount: entry.sockets.size, socketIds: Array.from(entry.sockets), lastSeen: entry.lastSeen });
  }
  return out;
};

export const isDeviceActive = (userId, deviceId) => {
  const devices = userMap.get(userId);
  if (!devices) return false;
  const entry = devices.get(deviceId || 'unknown');
  return !!(entry && entry.sockets.size > 0);
};

export const clearAll = () => {
  userMap.clear();
  socketMap.clear();
};

export default {
  registerSocket,
  unregisterSocket,
  getActiveDevicesForUser,
  isDeviceActive,
  clearAll,
};
