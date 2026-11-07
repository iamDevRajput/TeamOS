import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SessionUser } from '@teamos/database';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): SessionUser | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.user || null;
  },
);

