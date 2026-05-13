# @ts-wire/storage

File upload handling for ts-wire via multer.

```bash
npm install @ts-wire/storage
```

---

## `@RequireFile(options?)`

Parses a multipart/form-data request and attaches the uploaded file to `req.file` (single) or `req.files` (multiple).

On failure (missing file, wrong type, too large) → `400 Bad Request`.

---

## Examples

**Single file:**

```typescript
import { Controller, Post } from '@ts-wire/core';
import { RequireFile } from '@ts-wire/storage';

@Controller('/uploads')
export class UploadController {
  @Post('/avatar')
  @RequireFile({ field: 'avatar', maxSizeMb: 2, allowedTypes: ['image/jpeg', 'image/png'] })
  uploadAvatar(req: Request, res: Response, { storageService }: Components) {
    const url = storageService.save(req.file!);
    res.json({ url });
  }
}
```

**Multiple files:**

```typescript
@Post('/photos')
@RequireFile({ field: 'photos', maxCount: 10, maxSizeMb: 5 })
uploadPhotos(req: Request, res: Response, components) {
  const urls = (req.files as Express.Multer.File[]).map(storageService.save);
  res.json({ urls });
}
```

---

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `field` | `string` | `'file'` | Form field name |
| `maxSizeMb` | `number` | `10` | Max file size in MB |
| `allowedTypes` | `string[]` | any | Allowed MIME types |
| `maxCount` | `number` | `1` | Max number of files (enables multi-upload) |
| `dest` | `string` | memory | Upload destination directory |

---

## Accessing uploaded files

```typescript
// single file
req.file   // Express.Multer.File

// multiple files
req.files  // Express.Multer.File[]
```

Each `Multer.File` contains `originalname`, `mimetype`, `size`, `buffer` (memory storage) or `path` (disk storage).
