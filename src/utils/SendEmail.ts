import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';
import { SendEmailProps, EmailTemplates } from '../../types';

dotenv.config();
sgMail.setApiKey(process.env.SENDGRID_API_KEY as string);
export const templates: EmailTemplates = {
	newUser: 'd-8e2f6e4fbb4d4a31a2ea7db1e8e3664e',
	notified: 'd-189c01af523f4775b0673617f86b74fb'
};
export const SendEmail = ({
	to,
	template,
	attachments,
	onSuccessfulSend,
	onFailedSend,
	otherProps
}: SendEmailProps) => {
	const msg:sgMail.MailDataRequired = {
		...otherProps,
		to: to,
		from: {
			email: 'no-reply@codpad.tech',
			name: 'CodPad',
		},
		templateId: template.id,
		dynamicTemplateData: template,
		attachments,
		
	};
	sgMail
		.send(msg)
		.then((data) => {
			console.log('Email sent');
			if (onSuccessfulSend) return onSuccessfulSend(data[0]);
		})
		.catch((error) => {
			throw new Error(error);
		});
};
