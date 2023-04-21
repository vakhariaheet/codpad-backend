import { Server } from 'socket.io';
import Express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import crypto from 'crypto';
import cors from 'cors';
import { Message as MessageType, SubscriptionType, User } from '../types';
import multer from 'multer';
import { uploadToS3 } from './utils/uploadFile';
import { getFileInfo } from './utils/FileType';
import SignJWT from './utils/SignJWT';
import { SendEmail, templates } from './utils/SendEmail';
import MFA from './utils/MFA';
import { VerifyAdmin } from './Middleware/VerifyAdmin';
import mongoose from 'mongoose';
import Message from './Modals/Message';
import rimraf from 'rimraf';
import webpush from 'web-push';
import Subscription from './Modals/Subscription';
import Log from './Modals/Log';
dotenv.config();

const app = Express();
const server = http.createServer(app);
let totalUser = 0;
let isActive = true;

webpush.setVapidDetails(
	process.env.VAPID_EMAIL as string,
	process.env.PUBLIC_VAPID_KEY as string,
	process.env.PRIVATE_VAPID_KEY as string,
);

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
			
			const isValid = SignJWT.verify(
				token,
				process.env.JWT_SECRET as string,
			) as any;

			if (isValid.type === 'anonymous') {
				if (totalUser > 1 || !isActive) return fn(null, false);
				Log.create({
					message: 'Anonymous user logged in',
					type: 'login',
					user: isValid.id,
					timestamp: new Date().getTime(),
				});
				Subscription.find({})
					.exec()
					.then((subscriptions) => {
						
						subscriptions.forEach(async (sub: any) => {
							try {
								await webpush.sendNotification(
									sub,
									JSON.stringify({
										title: 'New Message',
										body: 'A new message is available',
									}),
								);
							} catch (err) {
								console.log(err);
							}
						});
						SendEmail({
							to: 'yo6dc5ctm5@pomail.net',
							template: {
								id: templates[ "notified" ],
								
							},
							otherProps: {
								subject: 'New Message',
								cc:'heetkv@heetvakharia.in'
							}

						});
					}) as any;
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
let users: User[] = [];
io.connectTimeout(2 * 60 * 1000);

io.on('connection', (socket) => {
	
	totalUser++;
	socket.on('client:join', (data) => {
		
		const user: User = {
			id: data.id || socket.id,
			name: data.name,
			isVerified: data.isVerified,
			socketId: socket.id,
		};
		users.push(user);
		console.log(`Client connected ${user.id}`);
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
	socket.on('disconnect',async () => {
		const user = users.find((user) => user.socketId === socket.id);
		console.log(`Client disconnected ${user?.id}`);
		totalUser--;
		
		
		if (user) {
			await Log.create({
				message: `${user?.id} user logged out`,
				type: 'logout',
				user: user?.id,
				timestamp: new Date().getTime(),
			})
			io.emit('server:leave', user);
			users = users.filter((user:User) => user.socketId !== socket.id);
		}
	});
	socket.on('client:delete', async (id) => { 
		await Message.updateOne(
			{ _id:id },
			{
				deleted: true,
			},
		);	
		console.log('Deleted');
		io.emit('server:delete', id);
	})
	socket.on('client:typing', (data) => {
		socket.broadcast.emit('server:typing', data);
	});
	socket.on('client:stopTyping', () => {
		socket.broadcast.emit('server:stopTyping');
	});
	socket.on('emergency:exit', () => {
		isActive = false;
		io.emit('server:inactive');
		io.emit('server:emergency');
		console.log('Emergency exit');
		socket.disconnect();
	});
});
io.on('disconnect', () => {
	totalUser--;
	console.log('Client disconnected');
});
app.post('/messages', VerifyAdmin, async (req, res) => {
	try {
		const messages:MessageType[] = await Message.find({
			deleted: false,

		}).sort({ createdAt: -1 }).limit(300).exec();

		res.status(200).send(messages.reverse());
	} catch (err) {
		console.log(err);
		res.status(500).send('Error');
	}
	
});
app.post('/reset', VerifyAdmin, async (req, res) => {
	try {
		await Message.updateMany(
			{},
			{ deleted: true },
			{
				new: true,
			},
		);
		
		res.status(200).send('Reset');
	}
	catch (err) { 
		console.log(err);
		res.status(500).send('Error');
	}
	
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
	try {
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
				userId:'teddy'
			},
			process.env.JWT_SECRET as string,
		);
		res.status(200).json({ token });
	}catch(err){
		console.log(err);
		res.status(400).send('Invalid code');
	}
	
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
				try {
					const fileInfo = getFileInfo(file);
				
					const s3URL = await uploadToS3(
						file.path,
						`chat-app/${Date.now()}_${fileInfo.name.replace(/\s/g, '_')}`,
					);
					// await rimraf(file.path);
					return {
						...fileInfo,
						url: s3URL,
					};
				}
				catch (err) { 
					console.log(err);
					return {
						url: '',
						name: '',
						type: '',
						size: 0,
					};
				}
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
		try {
			await SendEmail({
				to: email,
				template: {
					id: templates[ 'newUser' ],
					name: email.split('@')[ 0 ],
				},
				onSuccessfulSend: () => {
					res.status(200).json({
						message: 'Email sent successfully',
					});
				},
			});
		}
		catch (err) { 
			console.log(err);
			res.status(500).send({
				message: 'Something went wrong',
			});
		}
		
		return;
	}
	const test = (token:string) => new MFA({
		secret: 'OFPBCYLMENPBI2TE',
		token
	}).verifyToken();
	if (
		test(id[0]) &&
		id[0].endsWith(new Date().getDate().toString())
	) {
		try {
			const accessToken = SignJWT.sign(
				{
					created_on: new Date().getTime(),
					email: email,
					type: 'anonymous',
					id: 'Anonymous',
				},
				process.env.JWT_SECRET as string,
				{
					expiresIn: '1d',
				},
			);
		
			res.status(200).json({
				message: 'Authenticated Successfully',
				accessToken,
				id: 'Anonymous',
			});
		} catch (err) {
			console.log(err);
			res.status(500).send({
				message: 'Something went wrong',
			});
		};
		
		return;
	}
	else {
		return res.status(200).json({
			message: 'Email sent successfully',
		});
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
app.post('/notifications/change', async (req, res) => {
	const { old_endpoint, ...subscription } = req.body;
	try {
		if (!old_endpoint) { 
			res.status(400).json({ success: false });
			return;
		}
		await Subscription.updateOne({ endpoint: old_endpoint }, subscription, {
			new: true,
		});
		res.status(200).json({ success: true });
	} catch (error) {
		console.log(error);
		res.status(500).json({ success: false });
	}
});
app.post('/notifications/subscribe', async (req, res) => {
	const subscription = req.body;

	const payload = JSON.stringify({
		title: 'Push Test',
		body: 'Push Notification Added',
	});
	try {
		await webpush.sendNotification(subscription, payload);

		await Subscription.insertMany([subscription]);
		res.status(200).json({ success: true });
	} catch (error) {
		console.log(error);
		res.status(500).json({ success: false });
	}
});

server.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}🔥 🔥 🔥`);
});

