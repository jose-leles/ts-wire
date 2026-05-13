import multer, { StorageEngine, Options } from 'multer';
import { Use } from '@ts-wire/core';

export interface FileOptions {
  field?: string;
  maxSizeMb?: number;
  allowedTypes?: RegExp;
  storage?: StorageEngine;
}

export function RequireFile(options: FileOptions = {}) {
  const {
    field = 'file',
    maxSizeMb = 10,
    allowedTypes,
    storage = multer.memoryStorage(),
  } = options;

  const multerOptions: Options = {
    storage,
    limits: { fileSize: maxSizeMb * 1024 * 1024 },
    ...(allowedTypes
      ? {
          fileFilter: (_req, file, cb) => {
            cb(null, allowedTypes.test(file.mimetype));
          },
        }
      : {}),
  };

  const upload = multer(multerOptions).single(field);

  const middleware = (req: any, res: any, next: any) => {
    upload(req, res, (err: any) => {
      if (err) {
        const error = new Error(err.message) as Error & { statusCode: number };
        error.statusCode = 400;
        return next(error);
      }
      next();
    });
  };

  return Use(middleware);
}
