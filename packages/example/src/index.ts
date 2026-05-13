import { app } from '@ts-wire/core';
import { configureAuth } from '@ts-wire/auth';
import { UserController } from './controllers/user.controller';

configureAuth({ secret: process.env.JWT_SECRET ?? 'dev-secret' });

const server = app.bootstrap({
  controllers: [UserController],
});

server.listen(3000, () => console.log('http://localhost:3000'));
