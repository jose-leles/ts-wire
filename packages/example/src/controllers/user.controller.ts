import { Request, Response } from 'express';
import { Controller, Get, Post, With } from '@ts-wire/core';
import { RequireAuth } from '@ts-wire/auth';
import { Validate } from '@ts-wire/validate';
import { Cache, Idempotent } from '@ts-wire/cache';
import { UserService } from '../services/user.service';
import { CreateUserSchema } from '../dtos/create-user.dto';

@Controller('/users')
@With({ userService: UserService })
export class UserController {
  @Get('/')
  @Cache({ ttlMs: 30_000 })
  list(_req: Request, res: Response, { userService }: { userService: UserService }) {
    res.json(userService.findAll());
  }

  @Get('/:id')
  @RequireAuth()
  getOne(req: Request, res: Response, { userService }: { userService: UserService }) {
    const user = userService.findById(Number(req.params.id));
    res.json(user);
  }

  @Post('/')
  @Validate(CreateUserSchema)
  @Idempotent()
  create(req: Request, res: Response, { userService }: { userService: UserService }) {
    const user = userService.create(req.body);
    res.status(201).json(user);
  }
}
