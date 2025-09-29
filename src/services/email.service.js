import nodemailer from 'nodemailer';


//  @param {string} to - The recipient's email address.
//  @param {string} subject - The subject of the email.
//  @param {string} html - The HTML content of the email.
export const sendEmail = async (options) => {
    // "transporter" object with SMTP credentials  
    const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: false,  // true for 465, false for other ports
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
    // Defining email options
    const mailOptions = {
        from: process.env.EMAIL_FROM, // Sender address
        to: options.to,                 // Recipient's email address
        subject: options.subject,       // Email subject
        text: options.text,             // Plain text body
        html: options.html,             // HTML body (optional)
    };


    try {
        // Sending Mail
        await transporter.sendMail(mailOptions);;
        console.log('Email sent successfully!');
    } catch (error) {
        console.error('Error sending email:', error);
    }
};

