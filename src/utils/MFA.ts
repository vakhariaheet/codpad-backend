import { authenticator } from 'otplib';

export interface MFAProps {
	secret?: string;
	email?: string;
	token?: string;
}
export interface MFAInstance {
	secret?: string;
	email?: string;
	token?: string;
	generateSecret: () => string;
	generateURI: () => string;
	verifyToken: () => boolean;
	generateToken: () => string;
}
const MFA = function (this: MFAInstance, props: MFAProps = {}): MFAInstance {
	const { secret, email, token } = props;
	this.secret = secret;
	this.email = email;
	this.token = token;
	this.generateSecret = () => {
		return authenticator.generateSecret();
	};
	this.generateURI = () => {
		if (!this.secret || !this.email)
			throw new Error('Secret and Email are required to generate token');
		return `otpauth://totp/${this.email}?secret=${this.secret}&issuer=CodPad&algorithm=SHA1&digits=6&period=30`;
	};
	this.verifyToken = () => {
		if (!this.token || !this.secret)
			throw new Error('Token and Secret are required to verify token');

		return authenticator.verify({ token: this.token, secret: this.secret });
	};
	this.generateToken = () => {
		if (!this.secret) throw new Error('Secret is required to generate token');
		return authenticator.generate(this.secret);
	};
	return this;
} as any as { new (props?: MFAProps): MFAInstance };
export default MFA;
