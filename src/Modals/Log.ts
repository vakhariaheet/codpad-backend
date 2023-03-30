import { model, Schema, Document } from 'mongoose';


export interface Log extends Document { 
    message: string;
    type: string;
    user: string;
    timestamp: number;
}

const LogSchema = new Schema(
	{
		message: {
			type: String,
		},
		type: {
			type: String,
			enum: ['login', 'logout'],
		},
		user: {
			type: String,
		},
		timestamp: {
			type: Number,
		},
	},
	{
		timestamps: true,
	},
);


export default model<Log>('Log', LogSchema);