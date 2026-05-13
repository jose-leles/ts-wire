# @ts-wire/socket

WebSocket support for ts-wire via Socket.IO.

```bash
npm install @ts-wire/socket
```

---

## Setup

```typescript
import { createServer } from 'http';
import { app } from '@ts-wire/core';
import { setupSocket } from '@ts-wire/socket';
import { ChatController } from './controllers/chat.controller';
import { components } from './components';

const server = createServer(app.bootstrap({ controllers: [] }));

setupSocket(server, {
  controllers: [ChatController],
  components,
  cors: { origin: '*' },
});

server.listen(3000);
```

---

## `@SocketController(namespace?)`

Declares a socket controller. All event handlers in the class are registered on the given namespace (defaults to `/`).

```typescript
import { SocketController, OnEvent, OnConnect, OnDisconnect } from '@ts-wire/socket';

@SocketController('/chat')
export class ChatController {
  @OnConnect()
  connected(socket, { chatService }: Components) {
    console.log('client connected:', socket.id);
  }

  @OnEvent('message')
  message(socket, payload, { chatService }: Components) {
    const saved = chatService.save(payload);
    socket.to(payload.room).emit('message', saved);
  }

  @OnDisconnect()
  disconnected(socket, components) {
    console.log('client disconnected:', socket.id);
  }
}
```

---

## `SocketService`

Inject `SocketService` into your components to emit events from services or controllers:

```typescript
import { SocketService } from '@ts-wire/socket';

export const components = {
  socketService: new SocketService(),
  notificationService: new NotificationService(socketService),
} as const;
```

```typescript
// services/notification.service.ts
export class NotificationService {
  constructor(private socket: SocketService) {}

  notify(userId: string, event: string, payload: unknown) {
    this.socket.to(userId).emit(event, payload);
  }
}
```

---

## Handler signatures

```typescript
// @OnConnect / @OnDisconnect
(socket: Socket, components: Components) => void

// @OnEvent(eventName)
(socket: Socket, payload: unknown, components: Components) => void
```
