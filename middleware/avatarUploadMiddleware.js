import multer from 'multer';

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    
    console.log(`--- 2. Multer's fileFilter is processing file: ${file.originalname} ---`);
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only images are allowed.'), false);
    }
};

const limits = {
    fileSize: 5 * 1024 * 1024, // 6 MB
};

const avatarUpload = multer({
    storage,
    fileFilter,
    limits,
}).single('avatar'); // Expect a single file with the field name 'avatar'

export default avatarUpload;