import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SessionService } from '../session.service';
import { getSessionCookieName } from '../../common/cookies';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessionService: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const cookieName = getSessionCookieName();
    const rawToken = request.cookies?.[cookieName];

    if (!rawToken || typeof rawToken !== 'string') {
      throw new UnauthorizedException('Authentication required: no active session.');
    }

    const sessionUser = await this.sessionService.resolveSession(rawToken);
    if (!sessionUser) {
      throw new UnauthorizedException('Authentication required: session is invalid or expired.');
    }

    // Attach authenticated identity to request
    (request as any).user = sessionUser;
    (request as any).sessionId = sessionUser.sessionId;

    return true;
  }
}

