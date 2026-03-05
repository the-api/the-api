import * as nodemailer from 'nodemailer';
import type { EmailParamsType, EmailConfig } from './types';
export declare class Email {
    private transport;
    private from;
    constructor(config?: EmailConfig);
    send({ to, subject, text, html, }: Pick<EmailParamsType, 'to' | 'subject' | 'text' | 'html'>): Promise<nodemailer.SentMessageInfo>;
    compile(template: string | undefined, data?: Record<string, unknown>): string;
}
//# sourceMappingURL=Email.d.ts.map