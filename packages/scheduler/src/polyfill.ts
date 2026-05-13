// Symbol.metadata polyfill — required on Node < 22 and environments without native support
if (typeof Symbol.metadata === 'undefined') {
  (Symbol as any).metadata = Symbol('Symbol.metadata');
}
