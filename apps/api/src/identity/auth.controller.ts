import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthMeResponseDto, LogoutResponseDto } from '@teamos/contracts';
import { SessionUser } from '@teamos/database';
import { config } from '../common/config';
import {
  getOAuthCookieName,
  getSessionCookieName,
  getCookieOptions,
} from '../common/cookies';
import { GitHubOAuthService } from './github-oauth.service';
import { SessionService } from './session.service';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthGuard } from './guards/auth.guard';

@Controller('auth')
@UseGuards(AuthGuard)
export class AuthController {
  constructor(
    private readonly oauthService: GitHubOAuthService,
    private readonly sessionService: SessionService,
  ) {}

  @Public()
  @Get('github/login')
  login(
    @Query('redirect') redirect: string | undefined,
    @Res() res: Response,
  ): void {
    const { authorizeUrl, signedCookieValue } =
      this.oauthService.createAuthorizationUrl(redirect);

    res.cookie(
      getOAuthCookieName(),
      signedCookieValue,
      getCookieOptions(600), // 10 minutes transaction TTL
    );

    res.redirect(authorizeUrl);
  }

  @Public()
  @Get('github/callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const oauthCookieName = getOAuthCookieName();
    const signedCookieValue = req.cookies?.[oauthCookieName];

    // Clear transaction cookie immediately to prevent replay
    res.clearCookie(oauthCookieName, getCookieOptions(0));

    if (!code) {
      throw new BadRequestException('OAuth callback error: missing authorization code.');
    }

    // Verify HMAC and state
    const payload = this.oauthService.verifyAndConsumeOAuthCookie(
      signedCookieValue,
      state,
    );

    // Exchange code for token with PKCE verifier
    const accessToken = await this.oauthService.exchangeCodeForToken(
      code,
      payload.codeVerifier,
    );

    // Fetch GitHub identity
    const profile = await this.oauthService.fetchGitHubUserProfile(accessToken);

    // Bootstrap user account
    const user = await this.sessionService.upsertOAuthUser(profile);

    // Issue secure session
    const userAgent = req.headers['user-agent'] as string | undefined;
    const { rawToken } = await this.sessionService.createSession(user.id, userAgent);

    res.cookie(
      getSessionCookieName(),
      rawToken,
      getCookieOptions(14 * 86400), // 14 days
    );

    const destination = new URL(payload.redirectPath, config.appOrigin).toString();
    res.redirect(destination);
  }

  @Get('me')
  getProfile(@CurrentUser() user: SessionUser): AuthMeResponseDto {
    return {
      user: {
        id: user.userId,
        login: user.login,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
      sessionId: user.sessionId,
      expiresAt: user.expiresAt.toISOString(),
      lastActiveAt: user.lastActiveAt.toISOString(),
    };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<LogoutResponseDto> {
    const sessionCookieName = getSessionCookieName();
    const rawToken = req.cookies?.[sessionCookieName];

    if (rawToken) {
      await this.sessionService.revokeSession(rawToken);
    }

    res.clearCookie(sessionCookieName, getCookieOptions(0));

    return { success: true };
  }
}

