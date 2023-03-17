interface File {
	fieldname: string;
	originalname: string;
	encoding: string;
	mimetype: string;
	destination: string;
	filename: string;
	path: string;
	size: number;
	s3URL: string;
}
const supportedFileTypes = ['image', 'video', 'audio', 'file'];
export const getFileInfo = (file: globalThis.Express.Multer.File) => {
	const { originalname, mimetype, size } = file;
	const info: {
		name: string;
		type: string;
		size: number;
	} = {
		name: '',
		type: '',
		size: 0,
	};
	info.name = originalname;
	info.type = supportedFileTypes.includes(mimetype.split('/')[0])
		? mimetype.split('/')[0]
		: 'file';
	info.size = size;
	return info;
};

