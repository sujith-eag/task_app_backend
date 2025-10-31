import { MulterError } from 'multer';

/**
 * Global Error Handler Middleware
 * Catches all errors thrown in the application and formats them for the client
 * Should be the last middleware registered in the application
 */
const errorHandler = (err, req, res, next) => {
    console.error('--- GLOBAL ERROR HANDLER CAUGHT AN ERROR ---');
    console.error(err.stack); // Log the full error stack
    const statusCode = res.statusCode ? res.statusCode : 500;

    // --- Custom Multer Error Handling ---
    if (err instanceof MulterError) {
        let message = 'An upload error occurred.';
        switch (err.code) {
            case 'LIMIT_FILE_SIZE':
                message = 'File is too large. Maximum size allowed is 10MB.';
                break;
            case 'LIMIT_FILE_COUNT':
                message = 'Too many files uploaded. Maximum is 4 at a time.';
                break;
        }
        return res.status(400).json({ message });
    }

    // --- Custom File Filter Error Handling ---
    if (err.message === 'Invalid file type.') {
        return res.status(400).json({ 
	        message: 'Invalid file type.' });
    }

    // --- Default Error Handling ---
    res.status(statusCode).json({
        message: err.message,
        // Show stack trace only in development environment
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
};

export default errorHandler;
