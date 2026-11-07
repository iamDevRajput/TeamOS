import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Membership } from '@teamos/database';

export const CurrentOrgId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.orgId || request.params?.orgId || '';
  },
);

export const CurrentMembership = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): Membership | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.membership || null;
  },
);

