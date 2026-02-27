import { Routings } from 'the-api-routings';
import { Email } from '../Email';
import type { Next } from 'hono';
import type { AppContext, EmailParamsType } from '../types';

const emailMiddleware = async (c: AppContext, n: Next) => {
  const email = new Email();

  c.set(
    'email',
    async ({ to, template, data, ...emailParams }: EmailParamsType) => {
      const tpl = c.var.getTemplateByName(template ?? '');

      let { subject = '', text = '', html = '' } = { ...tpl, ...emailParams };

      if (!subject || (!text && !html)) {
        throw new Error('EMAIL_REQUIRES_FIELDS');
      }

      if (!html) html = text;

      if (data) {
        subject = email.compile(subject, data);
        text = email.compile(text, data);
        html = email.compile(html, data);
      }

      await email.send({ to, subject, text, html });
    },
  );

  await n();
};

const emailRoute = new Routings();
emailRoute.use('*', emailMiddleware);
emailRoute.errors({
  EMAIL_REQUIRES_FIELDS: {
    code: 125,
    status: 400,
    description:
      'Email requires both a subject and either text or HTML content',
  },
});

export { emailRoute as email };
