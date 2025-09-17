import multer from 'multer';

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only images are allowed.'), false);
    }
};

const limits = {
    fileSize: 3 * 1024 * 1024, // 2 MB
};

const avatarUpload = multer({
    storage,
    fileFilter,
    limits,
}).single('avatar'); // Expect a single file with the field name 'avatar'

export default avatarUpload;