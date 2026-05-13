import { NotFound } from '@ts-wire/errors';

const users = [
  { id: 1, name: 'Alice', email: 'alice@example.com' },
  { id: 2, name: 'Bob',   email: 'bob@example.com' },
];

export class UserService {
  findAll() {
    return users;
  }

  findById(id: number) {
    const user = users.find(u => u.id === id);
    if (!user) throw new NotFound(`User ${id} not found`);
    return user;
  }

  create(data: { name: string; email: string; password: string }) {
    const user = { id: Date.now(), name: data.name, email: data.email };
    users.push(user);
    return user;
  }
}
