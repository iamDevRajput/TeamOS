import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrgRole } from '@teamos/contracts';
import { REQUIRED_ORG_ROLE_KEY } from '../decorators/require-role.decorator';
import { TenancyService } from '../tenancy.service';
import crypto from 'crypto';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ROLE_HIERARCHY: Record<OrgRole, number> = {
  OWNER: 3,
  ADMIN: 2,
  MEMBER: 1,
};

@Injectable()
export class OrgMembershipGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenancyService: TenancyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.userId) {
      throw new UnauthorizedException('Authentication required.');
    }

    // 1. Resolve orgId from route params or headers
    const orgId =
      request.params?.orgId ||
      request.headers?.['x-org-id'] ||
      (request.body && typeof request.body === 'object' ? request.body.orgId : undefined);

    if (!orgId || typeof orgId !== 'string') {
      throw new BadRequestException('Organization context error: missing orgId.');
    }

    if (!UUID_REGEX.test(orgId)) {
      throw new BadRequestException(`Organization context error: "${orgId}" is not a valid UUID.`);
    }

    // 2. Verify active membership
    const membership = await this.tenancyService.getMembership(orgId, user.userId);
    if (!membership) {
      throw new ForbiddenException('Access denied: you are not a member of this organization.');
    }

    // 3. Check role requirement
    const requiredRole = this.reflector.getAllAndOverride<OrgRole | undefined>(
      REQUIRED_ORG_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredRole) {
      const userLevel = ROLE_HIERARCHY[membership.role as OrgRole] || 0;
      const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;

      if (userLevel < requiredLevel) {
        throw new ForbiddenException(
          `Access denied: required role is ${requiredRole}, but your role is ${membership.role}.`,
        );
      }
    }

    // 4. Attach tenant context to request
    request.orgId = orgId;
    request.membership = membership;
    request.tenantContext = {
      orgId,
      userId: user.userId,
      role: membership.role as OrgRole,
      requestId: crypto.randomUUID(),
    };

    return true;
  }
}
