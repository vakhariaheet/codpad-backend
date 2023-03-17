import {S3Client,PutObjectCommand} from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();
const s3 = new S3Client({
	region:process.env.AWS_REGION
})
/**
 * Uploads File To AWS S3 
 * @param path Multer file path
 * @param destPath Destination path in S3
 * @returns {Promise<string>} S3 file URL
 */
export const uploadToS3 = async (
	path: string,
	destPath: string,
) => {
	try {
		const file = fs.createReadStream(path);
		await s3.send(new PutObjectCommand({
			Bucket: process.env.AWS_BUCKET,
			Key: destPath,
			Body: file,
		}));
		return `https://${process.env.AWS_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${destPath}`
	} catch (error) {
		throw error;
	}
};

