import {
  HttpError, BadRequest, Unauthorized, Forbidden,
  NotFound, Conflict, UnprocessableEntity, TooManyRequests, InternalError,
} from '@ts-wire/errors';

const cases: [new (msg?: string) => HttpError, number][] = [
  [BadRequest,          400],
  [Unauthorized,        401],
  [Forbidden,           403],
  [NotFound,            404],
  [Conflict,            409],
  [UnprocessableEntity, 422],
  [TooManyRequests,     429],
  [InternalError,       500],
];

describe('HttpError subclasses', () => {
  test.each(cases)('%s has correct statusCode', (Cls, code) => {
    expect(new Cls().statusCode).toBe(code);
  });

  test.each(cases)('%s is instanceof HttpError', (Cls) => {
    expect(new Cls()).toBeInstanceOf(HttpError);
  });

  test.each(cases)('%s is instanceof Error', (Cls) => {
    expect(new Cls()).toBeInstanceOf(Error);
  });

  test('custom message is preserved', () => {
    expect(new NotFound('User 42 not found').message).toBe('User 42 not found');
  });

  test('default message used when none provided', () => {
    expect(new NotFound().message).toBe('Not Found');
  });

  test('name matches class name', () => {
    expect(new NotFound().name).toBe('NotFound');
    expect(new BadRequest().name).toBe('BadRequest');
  });
});
