import * as jwt from 'jsonwebtoken';
export default class SignJWT {
	private constructor() {}
	public static sign(payload: any, secret: string, options?: jwt.SignOptions) {
		return jwt.sign(payload, secret, options);
	}
	public static verify(
		token: string,
		secret: string,
		options?: jwt.VerifyOptions,
	) {
		return jwt.verify(token, secret, options);
	}
}
