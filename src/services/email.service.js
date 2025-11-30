import nodemailer from 'nodemailer';
import Brevo from '@getbrevo/brevo';


/**
 * @param {object} options - Email options object
 * @param {string} options.to - The recipient's email address.
 * @param {string} options.subject - The subject of the email.
 * @param {string} options.text - The plain text content of the email.
 * @param {string} [options.html] - The HTML content of the email (optional).
*/
export const sendEmail = async (options) => {
    // Skip sending emails in test environment
    if (process.env.NODE_ENV === 'test') {
        console.log('[TEST] Skipping email send:', options.subject);
        return { success: true, test: true };
    }

    const api = new Brevo.TransactionalEmailsApi();

    // Set the API key for authentication
    api.setApiKey(
        Brevo.TransactionalEmailsApiApiKeys.apiKey,
        process.env.BREVO_API_KEY
    );

    // Construct the email payload for Brevo
    const sendSmtpEmail = new Brevo.SendSmtpEmail();

    sendSmtpEmail.subject = options.subject;
    sendSmtpEmail.textContent = options.text;
    sendSmtpEmail.htmlContent = options.html; // Will be used if provided
    sendSmtpEmail.sender = { email: process.env.BREVO_SENDER_EMAIL };
    sendSmtpEmail.to = [{ email: options.to }];

    try {
        // Sending email using Brevo API
        await api.sendTransacEmail(sendSmtpEmail);
        console.log('Email sent successfully via Brevo!');
    } catch (error) {
        console.error('Error sending email via Brevo:', error);
        // Throw error to be caught by the controller
        throw error;
    }
};


// CURRENTLY NOT USING AFTER SHIFTING TO BREVO API
/**
 *  @param {string} to - The recipient's email address.
 *  @param {string} subject - The subject of the email.
 *  @param {string} html - The HTML content of the email.
*/
export const sendSMTPEmail = async (options) => {
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
