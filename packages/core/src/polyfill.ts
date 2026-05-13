// Symbol.metadata polyfill — necessário em Node < 22 e ambientes sem suporte nativo
if (typeof Symbol.metadata === 'undefined') {
  (Symbol as any).metadata = Symbol('Symbol.metadata');
}
