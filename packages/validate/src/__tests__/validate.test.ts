import request from 'supertest';
import { z } from 'zod';
import { Request, Response } from 'express';
import { TsBoot, Controller, Post, Get } from '@ts-wire/core';
import { Validate } from '@ts-wire/validate';

beforeEach(() => jest.spyOn(console, 'table').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

const UserSchema = z.object({
  name:  z.string().min(2),
  email: z.string().email(),
  age:   z.number().int().min(0),
});

@Controller('/validate')
class C {
  @Post('/body')
  @Validate(UserSchema)
  create(req: Request, res: Response) { res.status(201).json(req.body); }

  @Get('/params/:id')
  @Validate(z.object({ id: z.string().regex(/^\d+$/, 'id must be numeric') }), 'params')
  byId(req: Request, res: Response) { res.json({ id: req.params.id }); }
}

const app = new TsBoot().bootstrap({ controllers: [C] });

describe('@Validate body', () => {
  test('valid body → 201 with parsed data', async () => {
    await request(app)
      .post('/validate/body')
      .send({ name: 'Alice', email: 'alice@example.com', age: 30 })
      .expect(201, { name: 'Alice', email: 'alice@example.com', age: 30 });
  });

  test('missing required field → 400', async () => {
    const res = await request(app)
      .post('/validate/body')
      .send({ name: 'Alice' })
      .expect(400);
    expect(res.body.message).toBe('Validation failed');
    expect(res.body.details).toBeDefined();
  });

  test('invalid email → 400 with field details', async () => {
    const res = await request(app)
      .post('/validate/body')
      .send({ name: 'Alice', email: 'not-an-email', age: 25 })
      .expect(400);
    const emailError = res.body.details.find((d: any) => d.field === 'email');
    expect(emailError).toBeDefined();
  });

  test('name too short → 400', async () => {
    const res = await request(app)
      .post('/validate/body')
      .send({ name: 'A', email: 'a@b.com', age: 20 })
      .expect(400);
    const nameError = res.body.details.find((d: any) => d.field === 'name');
    expect(nameError).toBeDefined();
  });

  test('extra fields are stripped', async () => {
    const res = await request(app)
      .post('/validate/body')
      .send({ name: 'Alice', email: 'alice@example.com', age: 30, hacker: 'xss' })
      .expect(201);
    expect(res.body).not.toHaveProperty('hacker');
  });
});

describe('@Validate params', () => {
  test('numeric id passes', async () => {
    await request(app).get('/validate/params/42').expect(200, { id: '42' });
  });

  test('non-numeric id → 400', async () => {
    await request(app).get('/validate/params/abc').expect(400);
  });
});
