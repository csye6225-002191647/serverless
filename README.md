# Lambda Function for GitHub Release Download and Email Notification

## Overview

This repository contains an AWS Lambda function designed to be invoked by an SNS notification. The Lambda function is responsible for the following tasks:

1. **Download GitHub Release**: Downloads the latest release from a specified GitHub repository.

2. **Store in Google Cloud Storage Bucket**: Uploads the downloaded release to a designated Google Cloud Storage (GCS) bucket.

3. **Email Notification**: Sends an email to the user notifying them about the status of the download operation.

4. **Email Tracking**: Tracks the emails sent by storing relevant information in Amazon DynamoDB.

## Configuration

### AWS Lambda

1. Ensure that the Lambda function has the necessary IAM roles with permissions to download from GitHub, upload to GCS, and send emails.

2. Set up the Lambda function's environment variables:

    - `GITHUB_REPO_URL`: The URL of the GitHub repository to download the release from.
    - `GCS_BUCKET_NAME`: The name of the Google Cloud Storage bucket to store the downloaded release.
    - `RECIPIENT_EMAIL`: The email address of the user to notify.

### AWS SNS

Set up an SNS topic to trigger the Lambda function. Configure the GitHub repository to send notifications to this SNS topic upon release.

### Google Cloud Storage

Ensure that the Lambda function has the necessary permissions to upload files to the specified GCS bucket.

### Amazon DynamoDB

Create a DynamoDB table to store information about the emails sent, including timestamps and status.

## Usage

1. When a new release is created in the configured GitHub repository, an SNS notification triggers the Lambda function.

2. The Lambda function downloads the release, uploads it to the GCS bucket, and sends an email to the specified user with the status of the download.

3. Information about the sent email is recorded in the DynamoDB table for tracking purposes.

## Dependencies

- [GitHub API](https://developer.github.com/v3/): Used to download the latest release from the GitHub repository.

- [Google Cloud Storage API](https://cloud.google.com/storage/docs/apis): Used to upload the release to the GCS bucket.

- [Mailgun](https://app.mailgun.com/mg/dashboard): Used to send email notifications.

- [Amazon DynamoDB](https://aws.amazon.com/dynamodb/): Used to track emails sent.

## Contributing

If you have suggestions or find issues, please open an [issue](https://github.com/your/repository/issues) or submit a [pull request](https://github.com/your/repository/pulls). Contributions are welcome!