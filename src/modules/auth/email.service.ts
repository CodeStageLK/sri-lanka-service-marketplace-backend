import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

export type EmailDeliveryStatus = 'accepted' | 'not_configured';

export class DevelopmentEmailAdapter {
  private readonly logger = new Logger(DevelopmentEmailAdapter.name);

  deliver(): EmailDeliveryStatus {
    this.logger.warn('Email delivery is disabled; no email was delivered.');
    return 'not_configured';
  }
}

@Injectable()
export class EmailService {
  private readonly developmentAdapter = new DevelopmentEmailAdapter();
  private readonly transporter?: Transporter;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    if (!host) return;

    this.transporter = nodemailer.createTransport({
      host,
      port: this.config.getOrThrow<number>('SMTP_PORT'),
      secure: this.config.getOrThrow<boolean>('SMTP_SECURE'),
      auth: {
        user: this.config.getOrThrow<string>('SMTP_USER'),
        pass: this.config.getOrThrow<string>('SMTP_PASSWORD'),
      },
    });
  }

  async sendVerificationEmail(
    email: string,
    token: string,
  ): Promise<EmailDeliveryStatus> {
    return this.send(email, 'Verify your SERV HUB account', '/verify-email', token);
  }

  async sendPasswordResetEmail(
    email: string,
    token: string,
  ): Promise<EmailDeliveryStatus> {
    return this.send(email, 'Reset your SERV HUB password', '/reset-password', token);
  }

  private async send(
    email: string,
    subject: string,
    path: string,
    token: string,
  ): Promise<EmailDeliveryStatus> {
    if (!this.transporter) return this.developmentAdapter.deliver();

    const url = new URL(path, this.config.getOrThrow<string>('AUTH_APP_URL'));
    url.searchParams.set('token', token);
    const info = await this.transporter.sendMail({
      from: this.config.getOrThrow<string>('SMTP_FROM'),
      to: email,
      subject,
      text: `Use this single-use link before it expires: ${url.toString()}`,
    });
    if ((info.accepted?.length ?? 0) === 0 || (info.rejected?.length ?? 0) > 0) {
      throw new Error('The configured email provider did not accept the message.');
    }
    return 'accepted';
  }
}
