# AWS End User Messaging Social (WhatsApp)

This Chat provider sends WhatsApp Business messages through the AWS `SendWhatsAppMessage` API using AWS SDK v3 and SigV4 authentication. It is separate from the Meta-token-based `whatsapp-business` provider.

## Set up the integration

1. Link your WhatsApp Business Account and sending phone number in AWS End User Messaging Social.
2. Give the worker's IAM role or AWS credentials permission to call `social-messaging:SendWhatsAppMessage` for that phone number resource. Follow the AWS service authorization reference to scope access.
3. In Novu, add the **AWS End User Messaging Social (WhatsApp)** Chat integration (`aws-whatsapp`).
4. Set the AWS region, the AWS origination phone number resource ID (`phone-number-id-...` or its ARN), and a Meta API version supported by AWS in that region (for example, `v22.0`, where supported). The AWS resource ID is different from the numeric Meta phone number ID.
5. Supply both AWS access keys, or leave both empty to use the AWS SDK default credential chain on the worker, including an ECS task or EC2 instance role. For temporary access keys, also supply the AWS session token. Manually configured temporary credentials expire; use a worker role for automatic credential refresh.
6. Set the subscriber's `phone` in E.164 format, including `+` and the country code, or create a `phone` channel endpoint bound to this integration. Select the integration for your workflow's Chat step.

The integration uses existing Novu credential fields:

| Field | AWS setting |
| --- | --- |
| `apiKey` | Access key ID (optional with a worker role) |
| `secretKey` | Secret access key (optional with a worker role) |
| `token` | Session token for explicit temporary credentials |
| `region` | AWS region |
| `phoneNumberIdentification` | AWS origination phone number ID or ARN |
| `apiVersion` | Meta API version |

Access keys and session tokens use Novu's existing secure credential handling. No AWS credentials belong in trigger payloads or provider overrides.

## Send text or templates

The compiled Chat step body becomes a WhatsApp text message by default. A subscriber must opt in before you send messages. Free-form messages require an open 24-hour customer service window; outside that window, use an approved template.

In the Chat step's provider overrides, select **AWS End User Messaging Social (WhatsApp)** and supply the WhatsApp message fields. For example, a template with a named `nome` parameter:

```json
{
  "type": "template",
  "template": {
    "name": "lembrete_agendamento",
    "language": { "code": "pt_BR", "policy": "deterministic" },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "parameter_name": "nome", "text": "{{payload.nome}}" }
        ]
      }
    ]
  }
}
```

Use your approved template's exact name, language, and components. For positional parameters, omit `parameter_name` and preserve the order. Headers and buttons use the same native WhatsApp `components` format.

The provider follows the existing WhatsApp merge precedence: trigger custom data, then bridge provider data, then `_passthrough.body`. The selected message type removes unrelated message bodies.

## Send media

Use native WhatsApp image, document, audio, video, or sticker fields, with a supported media URL or an existing WhatsApp media ID:

```json
{
  "type": "document",
  "document": {
    "link": "https://example.com/appointment.pdf",
    "filename": "appointment.pdf",
    "caption": "Your appointment"
  }
}
```

The provider does not fetch URLs or upload local attachments. For private S3 media, import the object using AWS `PostWhatsAppMessageMedia` and pass the returned `mediaId` as `document.id` (or the corresponding media field's `id`). Import media with the same origination phone number used for sending. S3 staging, import permissions, and cleanup belong to the uploading application.

## Use the provider directly

```typescript
import { AwsWhatsAppChatProvider } from '@novu/providers';

const provider = new AwsWhatsAppChatProvider({
  region: 'us-east-1',
  originationPhoneNumberId: 'phone-number-id-YOUR_AWS_PHONE_NUMBER_ID',
  metaApiVersion: 'v22.0', // Choose a version supported by AWS in your region.
});

const result = await provider.sendMessage({
  content: 'Your appointment is confirmed.',
  channelData: {
    identifier: 'subscriber-phone',
    type: 'phone',
    endpoint: { phoneNumber: '+15555550123' },
  },
});
```

`result.id` is the AWS message ID. A successful send means AWS accepted the request; it does not confirm delivery. Configure an AWS message/event destination and consume delivery events separately. This provider does not implement inbound conversations, template administration, or consent recording. AWS errors propagate to Novu's existing worker failure handling; this provider adds no retry loop.

## Validation

See [validation results and known limits](./VALIDATION.md) for automated, Community, live AWS, IAM role and load checks.

## References

- [SendWhatsAppMessage API](https://docs.aws.amazon.com/social-messaging/latest/APIReference/API_SendWhatsAppMessage.html)
- [Sending WhatsApp messages](https://docs.aws.amazon.com/social-messaging/latest/userguide/whatsapp-send-message.html)
- [PostWhatsAppMessageMedia API](https://docs.aws.amazon.com/social-messaging/latest/APIReference/API_PostWhatsAppMessageMedia.html)
- [AWS End User Messaging Social service authorization](https://docs.aws.amazon.com/service-authorization/latest/reference/list_awsendusermessagingsocial.html)
