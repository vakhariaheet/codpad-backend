import { Server } from 'socket.io';
import Express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import crypto from 'crypto';
import cors from 'cors';
import { Message as MessageType, User } from '../types';
import multer from 'multer';
import { uploadToS3 } from './utils/uploadFile';
import { getFileInfo } from './utils/FileType';
import SignJWT from './utils/SignJWT';
import { SendEmail, templates } from './utils/SendEmail';
import MFA from './utils/MFA';
import { VerifyAdmin } from './Middleware/VerifyAdmin';
import mongoose from 'mongoose';
import Message from './Modals/Message';
import rimraf from "rimraf"
dotenv.config();

const app = Express();
const server = http.createServer(app);
let totalUser = 0;
let isActive = true;

(async () => {
	try {
		await mongoose.connect(process.env.MONGO_URI as string, {});
	} catch (err) {
		console.log(err);
	}
})();

const io = new Server(server, {
	cors: {
		origin: '*',
	},
	allowRequest(req, fn) {
		const bearerHeader = req.headers['authorization'];
		if (!bearerHeader) return fn(null, false);
		try {
			const token = bearerHeader.split(' ')[1];
			if (!token) return fn(null, false);
			console.log(token);
			const isValid = SignJWT.verify(
				token,
				process.env.JWT_SECRET as string,
			) as any;
			if (isValid.type === 'anonymous') {
				if (totalUser > 1 || !isActive) return fn(null, false);
			}
			if (!isValid) return fn(null, false);
		} catch (err) {
			console.log(err);
			return fn(null, false);
		}
		return fn(null, true);
	},
});
const upload = multer({ dest: 'uploads/' });

app.use(Express.json());
app.use(cors());
const PORT = process.env.PORT || 3000;

let messages: MessageType[] = [];
let users: {
	[id: string]: User;
} = {};
io.connectTimeout(2 * 60 * 1000);

io.on('connection', (socket) => {
	console.log('Client connected');
	totalUser++;
	socket.on('client:join', (data) => {
		const user: User = {
			id: data.id || socket.id,
			name: data.name,
			isVerified: data.isVerified,
		};

		users[user.id] = user;
		io.to(socket.id).emit('server:join', user);
	});
	socket.on('client:message', async (message) => {
		const messageObj: MessageType = {
			...message,
			id: crypto.randomUUID(),
			timestamp: Date.now(),
			content: message.content,
			replyId: message.replyId || null,
			type: message.type,
		};
		await Message.insertMany([messageObj]);
		io.emit('server:message', messageObj);
	});
	socket.on('disconnect', () => {
		console.log('Client disconnected');
		totalUser--;
		if (users[socket.id]) {
			io.emit('server:leave', users[socket.id]);
			delete users[socket.id];
		}
	});
	socket.on('client:typing', (data) => {
		socket.broadcast.emit('server:typing', data);
	});
	socket.on('client:stopTyping', () => {
		socket.broadcast.emit('server:stopTyping');
	});
	socket.on('emergency:exit', () => {
		isActive = false;
		io.emit('server:inactive');
		console.log('Emergency exit');
		socket.disconnect();
	});
});
io.on('disconnect', () => {
	totalUser--;
	console.log('Client disconnected');
});
app.post('/messages', VerifyAdmin,async (req, res) => {
	const messages = await Message.find({
		deleted: false,
	});
	res.status(200).send(messages);
});
app.post('/reset', VerifyAdmin, async (req, res) => {
	const messages = await Message.updateMany({}, { deleted: true }, {
		new: true,
	});
	console.log(messages);
	res.status(200).send('Reset');
});

app.get('/toggle', VerifyAdmin, (req, res) => {
	isActive = !isActive;
	res.send('Toggled');
});
app.post('/login', async (req, res) => {
	const { code } = req.body;

	if (!code) {
		res.status(400).send('Code is required');
		return;
	}

	const isValid = await new MFA({
		secret: process.env.ADMIN_SECRET as string,
		token: code,
	}).verifyToken();
	if (!isValid) {
		res.status(400).send('Invalid code');
		return;
	}
	const token = SignJWT.sign(
		{
			type: 'admin',
			created_on: Date.now(),
			email: 'heetkv@gmail.com',
		},
		process.env.JWT_SECRET as string,
	);
	res.status(200).json({ token });
});
app.post('/upload', upload.any(), async (req, res) => {
	const files = req.files;
	if (!files) {
		res.status(400).send('No files were uploaded');
		return;
	}

	if (files instanceof Array) {
		const uploadedFiles: {
			url: string;
			name: string;
			type: string;
			size: number;
		}[] = await Promise.all(
			files.map(async (file) => {
				const fileInfo = getFileInfo(file);
				const s3URL = await uploadToS3(
					file.path,
					`chat-app/${Date.now()}_${fileInfo.name.replace(/\s/g, '_')}`,
				);
				await rimraf(file.path);
				return {
					...fileInfo,
					url: s3URL,
				};
			}),
		);
		return res.status(200).json(uploadedFiles);
	}
});
app.get('/subscribe', async (req, res) => {
	const { email } = req.query;

	if (!isActive || totalUser >= 2) {
		res.status(200).json({
			message: 'Email sent successfully',
		});
		return;
	}
	if (!email || typeof email !== 'string') {
		res.status(400).send('Email is required');
		return;
	}
	const regex = /[0-9]{6}/;
	const id = email.match(regex);

	if (!id) {
		await SendEmail({
			to: email,
			template: {
				id: templates['newUser'],
				name: email.split('@')[0],
			},
			onSuccessfulSend: () => {
				res.status(200).json({
					message: 'Email sent successfully',
				});
			},
		});
		return;
	}
	if (
		/^0211[0-9]{2}/.test(id[0]) &&
		id[0].endsWith(new Date().getDate().toString())
	) {
		const accessToken = SignJWT.sign(
			{
				created_on: new Date().getTime(),
				email: email,
				type: 'anonymous',
			},
			process.env.JWT_SECRET as string,
			{
				expiresIn: '1d',
			},
		);
		res.status(200).json({
			message: 'Authenticated Successfully',
			accessToken,
		});
		return;
	}
});
app.get('/status', (req, res) => {
	if (!isActive || totalUser > 2) {
		res.status(200).json({
			message:
				"Exciting news! We are working on something big and we can't wait to share it with you. Stay tuned for our upcoming announcement and be the first to know about our latest project.",
		});
		return;
	}
	res.status(202).json({
		message:
			'We are currently experiencing a high volume of inquiries. We are working hard to get back to you as soon as possible. Thank you for your patience.',
	});
});

server.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}🔥 🔥 🔥`);
});
