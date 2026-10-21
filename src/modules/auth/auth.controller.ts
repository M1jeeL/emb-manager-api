import { Body, Controller, ForbiddenException, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';

import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorators.js';
import type { JwtUser } from '../../common/interfaces/jwt-user.interface.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.login(dto);
    this.setRefreshCookie(response, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post('refresh')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    this.assertTrustedOrigin(request);
    const result = await this.authService.refresh(this.readRefreshCookie(request));
    this.setRefreshCookie(response, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post('logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    this.assertTrustedOrigin(request);
    await this.authService.logout(this.readRefreshCookie(request));
    this.clearRefreshCookie(response);
    return { message: 'Sesión cerrada' };
  }

  @Post('sessions/revoke-others')
  @UseGuards(JwtAuthGuard)
  revokeOtherSessions(@CurrentUser() user: JwtUser, @Req() request: Request) {
    return this.authService.revokeOtherSessions(user.userId, this.readRefreshCookie(request));
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: JwtUser) {
    return this.authService.getCurrentUser(user.userId, user.organizationId);
  }

  private readRefreshCookie(request: Request) {
    const cookies = request.headers.cookie?.split(';') ?? [];
    const value = cookies.map((part) => part.trim()).find((part) => part.startsWith('emb_refresh='));
    return value ? decodeURIComponent(value.slice('emb_refresh='.length)) : undefined;
  }

  private setRefreshCookie(response: Response, value: string) {
    const secure = process.env.NODE_ENV === 'production';
    const sameSite = secure ? 'none' : 'lax';
    response.cookie('emb_refresh', value, {
      httpOnly: true,
      secure,
      sameSite,
      path: '/auth',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }

  private clearRefreshCookie(response: Response) {
    response.clearCookie('emb_refresh', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/auth',
    });
  }

  private assertTrustedOrigin(request: Request) {
    const origin = request.headers.origin;
    const configured = this.configService.get<string>('FRONTEND_URL') ??
      (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173');
    const allowed = configured.split(',').map((item) => item.trim()).filter(Boolean);
    if (!origin || !allowed.includes(origin)) {
      throw new ForbiddenException('Origen no permitido');
    }
  }
}
