import * as nodemailer from 'nodemailer';
import * as Handlebars from 'handlebars';
import type { EmailParamsType, EmailConfig } from './types';

export class Email {
  private transport: nodemailer.Transporter;
  private from: string;

  constructor(config?: EmailConfig) {
    const {
      EMAIL_USER: user,
      EMAIL_PASSWORD: pass,
      EMAIL_FROM: from,
      EMAIL_HOST: host,
      EMAIL_PORT: port,
      EMAIL_SECURE: isSecure,
      EMAIL_TLS_REJECTUNAUTH: rejectUnauth,
    } = process.env;

    const envConfig: EmailConfig = {
      auth: { user, pass },
      from,
      host,
      port: port ? parseInt(port, 10) : undefined,
      secure: isSecure === 'true',
      tls:
        rejectUnauth !== undefined
          ? { rejectUnauthorized: rejectUnauth === 'true' }
          : undefined,
    };

    const finalConfig = config || envConfig;
    this.transport = nodemailer.createTransport(
      finalConfig as nodemailer.TransportOptions,
    );
    this.from = finalConfig.from || finalConfig.auth?.user || '';
  }

  async send({
    to,
    subject,
    text,
    html,
  }: Pick<EmailParamsType, 'to' | 'subject' | 'text' | 'html'>): Promise<nodemailer.SentMessageInfo> {
    return this.transport.sendMail({ from: this.from, to, subject, text, html });
  }

  compile(template: string | undefined, data: Record<string, unknown> = {}): string {
    return Handlebars.compile(template || '')(data);
  }
}
