import {
  SocketController,
  OnEvent,
  OnConnect,
  OnDisconnect,
  SocketWith,
  SocketService,
  SM,
} from '../index';

// ---------------------------------------------------------------------------
// Helper — read Symbol.metadata from a class
// ---------------------------------------------------------------------------
function getMeta(cls: Function): Record<string, any> {
  return ((cls as any)[Symbol.metadata] ?? {}) as Record<string, any>;
}

// ---------------------------------------------------------------------------
// @SocketController
// ---------------------------------------------------------------------------
describe('@SocketController', () => {
  test('stores namespace in metadata', () => {
    @SocketController('/chat') class ChatCtrl {}
    expect(getMeta(ChatCtrl)[SM.NAMESPACE]).toBe('/chat');
  });

  test('defaults to "/" when no namespace given', () => {
    @SocketController() class RootCtrl {}
    expect(getMeta(RootCtrl)[SM.NAMESPACE]).toBe('/');
  });
});

// ---------------------------------------------------------------------------
// @OnEvent
// ---------------------------------------------------------------------------
describe('@OnEvent', () => {
  test('registers event entry with correct event and handlerName', () => {
    @SocketController('/chat')
    class ChatCtrl {
      @OnEvent('message')
      message() {}
    }
    const events: Array<{ event: string; handlerName: string }> =
      getMeta(ChatCtrl)[SM.EVENTS];
    expect(events).toContainEqual({ event: 'message', handlerName: 'message' });
  });

  test('multiple @OnEvent decorators accumulate', () => {
    @SocketController('/ns')
    class MultiCtrl {
      @OnEvent('ping')  ping() {}
      @OnEvent('pong')  pong() {}
      @OnEvent('hello') hello() {}
    }
    const events: Array<{ event: string; handlerName: string }> =
      getMeta(MultiCtrl)[SM.EVENTS];
    expect(events).toHaveLength(3);
    expect(events.map(e => e.event)).toEqual(
      expect.arrayContaining(['ping', 'pong', 'hello'])
    );
  });
});

// ---------------------------------------------------------------------------
// @OnConnect
// ---------------------------------------------------------------------------
describe('@OnConnect', () => {
  test('stores handler name in metadata', () => {
    @SocketController('/ns')
    class ConnCtrl {
      @OnConnect()
      onConnect() {}
    }
    expect(getMeta(ConnCtrl)[SM.ON_CONNECT]).toBe('onConnect');
  });
});

// ---------------------------------------------------------------------------
// @OnDisconnect
// ---------------------------------------------------------------------------
describe('@OnDisconnect', () => {
  test('stores handler name in metadata', () => {
    @SocketController('/ns')
    class DiscCtrl {
      @OnDisconnect()
      onDisconnect() {}
    }
    expect(getMeta(DiscCtrl)[SM.ON_DISCONNECT]).toBe('onDisconnect');
  });
});

// ---------------------------------------------------------------------------
// @SocketWith
// ---------------------------------------------------------------------------
describe('@SocketWith', () => {
  test('class-level stores components in COMPONENTS metadata', () => {
    const svc = { greet: () => 'hi' };
    @SocketController('/ns')
    @SocketWith({ svc })
    class WithCtrl {}
    expect(getMeta(WithCtrl)[SM.COMPONENTS]).toEqual({ svc });
  });

  test('class-level merges multiple @SocketWith', () => {
    @SocketController('/ns')
    @SocketWith({ a: 1 })
    @SocketWith({ b: 2 })
    class MultiWith {}
    expect(getMeta(MultiWith)[SM.COMPONENTS]).toEqual({ a: 1, b: 2 });
  });

  test('method-level stores per-event components in METHOD_COMPONENTS', () => {
    const extra = { x: 99 };
    @SocketController('/ns')
    class MethodWith {
      @OnEvent('data')
      @SocketWith({ extra })
      data() {}
    }
    const methodComps = getMeta(MethodWith)[SM.METHOD_COMPONENTS];
    expect(methodComps['data']).toEqual({ extra });
  });

  test('method-level merges multiple @SocketWith on same handler', () => {
    @SocketController('/ns')
    class MergeMethod {
      @OnEvent('ev')
      @SocketWith({ a: 1 })
      @SocketWith({ b: 2 })
      ev() {}
    }
    const methodComps = getMeta(MergeMethod)[SM.METHOD_COMPONENTS];
    expect(methodComps['ev']).toEqual({ a: 1, b: 2 });
  });

  test('method-level components are independent per handler', () => {
    @SocketController('/ns')
    class IndepMethod {
      @OnEvent('foo') @SocketWith({ foo: 'f' }) foo() {}
      @OnEvent('bar') @SocketWith({ bar: 'b' }) bar() {}
    }
    const methodComps = getMeta(IndepMethod)[SM.METHOD_COMPONENTS];
    expect(methodComps['foo']).toEqual({ foo: 'f' });
    expect(methodComps['bar']).toEqual({ bar: 'b' });
  });
});

// ---------------------------------------------------------------------------
// SocketService
// ---------------------------------------------------------------------------
describe('SocketService', () => {
  function makeMockIO() {
    return {
      emit: jest.fn(),
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    };
  }

  test('emit delegates to io.emit', () => {
    const mockIO = makeMockIO();
    const svc = new SocketService(mockIO as any);
    svc.emit('ping', { value: 1 });
    expect(mockIO.emit).toHaveBeenCalledWith('ping', { value: 1 });
  });

  test('emit with no data calls io.emit with undefined', () => {
    const mockIO = makeMockIO();
    const svc = new SocketService(mockIO as any);
    svc.emit('ping');
    expect(mockIO.emit).toHaveBeenCalledWith('ping', undefined);
  });

  test('to delegates to io.to and returns room reference', () => {
    const mockIO = makeMockIO();
    const svc = new SocketService(mockIO as any);
    const room = svc.to('room-42');
    expect(mockIO.to).toHaveBeenCalledWith('room-42');
    expect(room).toBe(mockIO.to.mock.results[0].value);
  });

  test('server getter returns the underlying io instance', () => {
    const mockIO = makeMockIO();
    const svc = new SocketService(mockIO as any);
    expect(svc.server).toBe(mockIO);
  });
});
