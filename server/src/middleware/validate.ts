import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        }));
        res.status(400).json({
          error: issues[0]?.message || 'Validation error',
          details: issues,
        });
        return;
      }
      res.status(400).json({ error: 'Invalid request payload.' });
    }
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req.query) as Record<string, any>;
      if (typeof parsed === 'object' && parsed !== null) {
        for (const [key, value] of Object.entries(parsed)) {
          (req.query as any)[key] = value;
        }
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        }));
        res.status(400).json({
          error: issues[0]?.message || 'Validation error',
          details: issues,
        });
        return;
      }
      res.status(400).json({ error: 'Invalid query parameters.' });
    }
  };
}
