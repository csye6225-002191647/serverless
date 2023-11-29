import axios from 'axios';
import { Storage } from '@google-cloud/storage';
import AWS from 'aws-sdk';
import mailgun from 'mailgun-js';
import { v4 as uuidv4 } from 'uuid';

const mg = mailgun({
    apiKey: process.env.MAILGUN_API_KEY,
    domain: process.env.MAILGUN_DOMAIN_NAME, 
});

// Initialize DynamoDB client
const dynamoDB = new AWS.DynamoDB.DocumentClient();

const decodedServiceAccountKey = JSON.parse(Buffer.from(process.env.GCP_SERVICE_ACCOUNT_KEY, 'base64').toString('utf-8'));

// Configure Google Cloud Storage
const storage = new Storage({
  projectId: decodedServiceAccountKey.project_id,
  credentials: {
    type: decodedServiceAccountKey.type,
    project_id: decodedServiceAccountKey.project_id,
    private_key_id: decodedServiceAccountKey.private_key_id,
    private_key: decodedServiceAccountKey.private_key,
    client_email: decodedServiceAccountKey.client_email,
    client_id: decodedServiceAccountKey.client_id,
    auth_uri: decodedServiceAccountKey.auth_uri,
    token_uri: decodedServiceAccountKey.token_uri,
    auth_provider_509_cert_url: decodedServiceAccountKey.auth_provider_509_cert_url,
    client_X509_cert_urs: decodedServiceAccountKey.client_X509_cert_urs
  },
});

export const handler = async (event) => {
    let userEmail;
    let emailStatus;
    try {
        const snsMessage = JSON.parse(event.Records[0].Sns.Message);
        const url = snsMessage.url;
        userEmail = snsMessage.email;
        const assignment_name = snsMessage.assignment
        const version = snsMessage.version

        console.log(`Downloading release from GitHub: ${url}`);

        // Download release from GitHub
        const response = await axios.get(url, { responseType: 'stream' });
        console.log('response', response)
        // Upload to Google Cloud Storage using Blob
        const bucketName = process.env.GCP_BUCKET_NAME;
        const destinationFileName = `${userEmail}_${assignment_name}_${version}`;
        const bucket = storage.bucket(bucketName);
        const blob = bucket.file(destinationFileName);

        const options = {
          version: 'v4', // Specify the signed URL version
          action: 'read', // Specify the action (read, write, delete, etc.)
          expires: Date.now() + 5 * 60 * 1000, // URL expiration time (15 minutes from now)
        };

        await new Promise((resolve, reject) => {
            const blobStream = blob.createWriteStream({
                resumable: false,
                contentType: response.headers['content-type'],
            });

            blobStream.on('error', async (error) => {
              console.error('Error uploading to GCS:', error);
               // Send email notification for failure
              await sendEmailNotification(userEmail, 'failure', error.message);
              // Track email status in DynamoDB for failure
              await trackEmailStatus('failure', userEmail);
              reject(error);
            });

            blobStream.on('finish', async () => {
                console.log(`File uploaded to ${bucketName}/${destinationFileName}`);
                // Send email notification
                const message = `Successfully uploaded - ${bucketName}/${destinationFileName}`
                emailStatus = await sendEmailNotification(userEmail, 'success', message);
                console.log(`Email notification sent with status: ${emailStatus}`);
                // Track email status in DynamoDB
                await trackEmailStatus('success', userEmail);
                console.log(`Email tracked: ${emailStatus}`);
                resolve();
            });
            response.data.pipe(blobStream);
        });
    } catch (error) {
        console.error('Error:', error);
        console.error('Errormessage:', error.message);
        let message;
        if(error.response.status === 404) {
          message = "Invalid submission URL"
        } else {
          message = error.message
        }
        // Send email notification for failure
        await sendEmailNotification(userEmail, 'failure', message);
        console.log(`Email notification sent with status: ${emailStatus}`);
        // Track email status in DynamoDB for failure
        await trackEmailStatus('failure', userEmail);
        console.log(`Email tracked: ${emailStatus}`);
    }
};

async function sendEmailNotification(userEmail, status, message) {

    const data = {
        from: `no-reply@${process.env.MAILGUN_DOMAIN_NAME}`, 
        to: userEmail,
        subject: `Download Status - ${status}`,
        html: `<p>The download process has ${status === 'success' ? 'succeeded' : 'failed'}.\n${message}</p>`,
        headers: {
            'X-MSMail-Priority': 'High',
        },
    };

    return new Promise((resolve, reject) => {
        mg.messages().send(data, (error, body) => {
            if (error) {
                console.error('Error sending email:', error);
                reject(error);
            } else {
                console.log('Email sent:', body);
                resolve('success');
            }
        });
    });
}

async function trackEmailStatus(status, userEmail) {
    const params = {
        TableName: process.env.DYNAMODB_TABLE_NAME,
        Item: {
            messageId: generateUniqueId(),
            recipient: userEmail,
            sentAt: new Date().toISOString(),
            status,
        },
    };
    await dynamoDB.put(params).promise();
}

function generateUniqueId() {
    return uuidv4();
}