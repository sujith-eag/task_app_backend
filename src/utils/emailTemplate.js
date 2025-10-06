import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * @param {string} templateName - The name of the HTML file in the emailTemplates directory.
 * @param {object} data - An object with keys matching the placeholders in the template.
 * @returns {Promise<string>} The populated HTML string.
 */
export const populateTemplate = async (templateName, data) => {
    try {
        
        // Get the directory name of the current module
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        
        // Construct a robust path relative to this file
        const templatePath = path.join(__dirname, 'emailTemplates', templateName);

        let html = await fs.readFile(templatePath, 'utf-8');

        // Replace placeholders like {{key}} with data from the object
        for (const key in data) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            html = html.replace(regex, data[key]);
        }

        return html;
    } catch (error) {
        console.error(`Error reading or populating email template: ${templateName}`, error);
        throw new Error('Could not process email template.');
    }
};