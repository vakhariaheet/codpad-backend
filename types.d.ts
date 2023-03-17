import { ClientResponse, MailDataRequired } from '@sendgrid/mail';
export interface Message {
	_id: string;
	type:
		| 'text'
		| 'image'
		| 'video'
		| 'audio'
		| 'file'
		| 'gif'
		| 'reply'
		| 'reaction';
	content: string;
	sender: string;
	timestamp: number;
	replyId: string | null;
}

export interface User { 
	id: string;
	name: string;
	isVerified: boolean;
}
export interface SendEmailProps extends MailDataRequired {
	to: string;
	template:
		| NewUserTemplateData
		| ResendVerificationTemplateData
		| ForgotPasswordTemplateData;
	attachments?: EmailAttachment[];
	onSuccessfulSend?: (data: ClientResponse) => void;
	onFailedSend?: (error: Error) => void;
}
export interface EmailTemplates {
	newUser: 'd-8e2f6e4fbb4d4a31a2ea7db1e8e3664e';
	notified: 'd-189c01af523f4775b0673617f86b74fb';
}
interface SubscriptionType {
  endpoint: string;
  expirationTime?: any;
  keys: Keys;
}

interface Keys {
  p256dh: string;
  auth: string;
}