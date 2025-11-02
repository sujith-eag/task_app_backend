## socket

Utilities for socket/session management used by the Socket.IO integration.

Files

- `sessionRegistry.js`
  - Purpose: an in-memory registry that tracks active socket connections per user and per device. It exposes functions
    to register/unregister sockets and to query active devices.
  - Exported functions:
    - `registerSocket(userId, deviceId, socketId)` — record a socket belonging to a user+device.
    - `unregisterSocket(socketId)` — remove a socket from the registry.
    - `getActiveDevicesForUser(userId)` — return a list of active devices with socket counts and lastSeen timestamps.
    - `isDeviceActive(userId, deviceId)` — boolean whether a device currently has active sockets.
    - `clearAll()` — clear the in-memory registry (useful for tests or controlled restarts).

Usage example

```js
import registry from './sessionRegistry.js';

io.on('connection', (socket) => {
  const userId = socket.user && socket.user._id;
  const deviceId = socket.handshake?.auth?.deviceId || socket.handshake?.headers?.['x-device-id'] || 'unknown';
  registry.registerSocket(userId, deviceId, socket.id);

  socket.on('disconnect', () => {
    registry.unregisterSocket(socket.id);
  });
});
```

Caveats & production guidance
- This registry is an in-memory Map. It will be lost on process restart and will not work correctly in multi-process
  or clustered deployments.
- For production, prefer a shared store like Redis (e.g., using a hash + sets) so multiple Node workers or servers
  can share session state. The registry's shape is intentionally small and easy to reproduce with Redis.

Testing
- `clearAll()` is provided to reset the internal state between tests.
