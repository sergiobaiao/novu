import { SendWhatsAppMessageCommand, SocialMessagingClient } from '@aws-sdk/client-socialmessaging';
import { ENDPOINT_TYPES } from '@novu/shared';
import { IChatOptions } from '@novu/stateless';
import nock from 'nock';
import { afterEach, expect, test, vi } from 'vitest';
import { AwsWhatsAppChatProvider } from './aws-whatsapp.provider';

const config = {
  region: 'us-east-1',
  originationPhoneNumberId: 'phone-number-id-01234567890123456789012345678901',
  metaApiVersion: 'v22.0',
  accessKeyId: 'test-access-key',
  secretAccessKey: 'test-secret-key',
};

const options: IChatOptions = {
  content: 'Olá, João!',
  channelData: {
    identifier: 'subscriber-phone',
    type: ENDPOINT_TYPES.PHONE,
    endpoint: { phoneNumber: '+5586999999999' },
  },
};

function mockSend() {
  return vi
    .spyOn(SocialMessagingClient.prototype, 'send')
    .mockImplementation(async () => ({ messageId: 'wamid.test' }));
}

function messageFrom(spy: ReturnType<typeof mockSend>) {
  const command = spy.mock.calls[0][0] as SendWhatsAppMessageCommand;

  return JSON.parse(Buffer.from(command.input.message).toString('utf8'));
}

afterEach(() => vi.restoreAllMocks());

test('sends UTF-8 text as bytes through the AWS SDK and preserves the E.164 recipient', async () => {
  const send = mockSend();
  const response = await new AwsWhatsAppChatProvider(config).sendMessage(options);

  expect(send).toHaveBeenCalledOnce();
  expect(send.mock.calls[0][0]).toBeInstanceOf(SendWhatsAppMessageCommand);
  expect(send.mock.calls[0][0].input).toEqual({
    originationPhoneNumberId: config.originationPhoneNumberId,
    metaApiVersion: config.metaApiVersion,
    message: expect.any(Uint8Array),
  });
  expect(messageFrom(send)).toEqual({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: '+5586999999999',
    type: 'text',
    text: { body: 'Olá, João!', preview_url: false },
  });
  expect(response).toEqual({ id: 'wamid.test', date: expect.any(String) });
});

test.each([
  { parameters: [{ type: 'text', text: 'João' }] },
  { parameters: [{ type: 'text', parameter_name: 'nome', text: 'João' }] },
])('preserves positional and named template parameters: %j', async ({ parameters }) => {
  const send = mockSend();
  const template = {
    name: 'lembrete_agendamento',
    language: { code: 'pt_BR' },
    components: [{ type: 'body', parameters }],
  };

  await new AwsWhatsAppChatProvider(config).sendMessage({ ...options, customData: { template } });

  expect(messageFrom(send)).toMatchObject({ type: 'template', template });
  expect(messageFrom(send)).not.toHaveProperty('text');
});

test.each(['image', 'document', 'audio', 'video', 'sticker'])('sends %s media by ID', async (type) => {
  const send = mockSend();
  await new AwsWhatsAppChatProvider(config).sendMessage({
    ...options,
    customData: { [type]: { id: 'uploaded-media-id' } },
  });

  expect(messageFrom(send)).toMatchObject({ type, [type]: { id: 'uploaded-media-id' } });
  expect(messageFrom(send)).not.toHaveProperty('text');
});

test('sends a document URL with its caption and filename', async () => {
  const send = mockSend();
  const document = { link: 'https://example.com/appointment.pdf', caption: 'Agendamento', filename: 'agendamento.pdf' };
  await new AwsWhatsAppChatProvider(config).sendMessage({ ...options, customData: { document } });
  expect(messageFrom(send)).toMatchObject({ type: 'document', document });
});

test('applies bridge overrides and passthrough with the existing WhatsApp precedence', async () => {
  const send = mockSend();
  const template = { name: 'reminder', language: { code: 'pt_BR' } };
  await new AwsWhatsAppChatProvider(config).sendMessage(
    { ...options, customData: { template } },
    { image: { id: 'bridge-image' }, _passthrough: { body: { document: { id: 'passthrough-document' } } } }
  );

  expect(messageFrom(send)).toMatchObject({ type: 'document', document: { id: 'passthrough-document' } });
  expect(messageFrom(send)).not.toHaveProperty('template');
  expect(messageFrom(send)).not.toHaveProperty('image');
});

test('uses the default credential chain when explicit keys are omitted', async () => {
  const send = mockSend();
  const { accessKeyId, secretAccessKey, ...roleConfig } = config;
  await new AwsWhatsAppChatProvider(roleConfig).sendMessage(options);
  expect(send).toHaveBeenCalledOnce();
});

test('signs the AWS HTTP request and base64-encodes the message exactly once', async () => {
  nock.disableNetConnect();
  const scope = nock('https://social-messaging.us-east-1.amazonaws.com', {
    reqheaders: {
      authorization: (value) => value.startsWith('AWS4-HMAC-SHA256 '),
      'x-amz-security-token': 'temporary-token',
    },
  })
    .post('/v1/whatsapp/send', (body) => {
      const message = JSON.parse(Buffer.from(body.message, 'base64').toString('utf8'));

      return (
        body.originationPhoneNumberId === config.originationPhoneNumberId &&
        body.metaApiVersion === config.metaApiVersion &&
        message.text.body === options.content &&
        message.to === '+5586999999999'
      );
    })
    .reply(200, { messageId: 'wamid.signed' });

  try {
    const response = await new AwsWhatsAppChatProvider({ ...config, sessionToken: 'temporary-token' }).sendMessage(
      options
    );
    expect(response.id).toBe('wamid.signed');
    expect(scope.isDone()).toBe(true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});

test.each([
  { ...config, secretAccessKey: undefined },
  { ...config, accessKeyId: undefined },
  { ...config, accessKeyId: undefined, secretAccessKey: undefined, sessionToken: 'temporary-token' },
])('rejects incomplete explicit credentials', (invalidConfig) => {
  expect(() => new AwsWhatsAppChatProvider(invalidConfig)).toThrow('requires both accessKeyId and secretAccessKey');
});

test('rejects a non-phone endpoint before calling AWS', async () => {
  const send = mockSend();
  await expect(
    new AwsWhatsAppChatProvider(config).sendMessage({
      content: 'hello',
      channelData: { identifier: 'webhook', type: ENDPOINT_TYPES.WEBHOOK, endpoint: { url: 'https://example.com' } },
    })
  ).rejects.toThrow('Invalid channel data');
  expect(send).not.toHaveBeenCalled();
});

test('propagates AWS errors to the worker retry and execution-detail handling', async () => {
  const error = new Error('AccessDeniedException');
  vi.spyOn(SocialMessagingClient.prototype, 'send').mockRejectedValue(error);
  await expect(new AwsWhatsAppChatProvider(config).sendMessage(options)).rejects.toBe(error);
});

test.each([
  { type: 'location', data: { latitude: 0, longitude: 0, name: 'Test location' } },
  { type: 'contacts', data: [{ name: { formatted_name: 'Test contact', first_name: 'Test' } }] },
  { type: 'reaction', data: { message_id: 'wamid.original', emoji: '\u{1F44D}' } },
  {
    type: 'interactive',
    data: {
      type: 'button',
      body: { text: 'Confirm?' },
      action: { buttons: [{ type: 'reply', reply: { id: 'yes', title: 'Yes' } }] },
    },
  },
])('preserves the native $type message body', async ({ type, data }) => {
  const send = mockSend();
  await new AwsWhatsAppChatProvider(config).sendMessage({ ...options, customData: { type, [type]: data } });
  expect(messageFrom(send)).toMatchObject({ type, [type]: data });
  expect(messageFrom(send)).not.toHaveProperty('text');
});

test('preserves template header and button components and reply context', async () => {
  const send = mockSend();
  const template = {
    name: 'appointment',
    language: { code: 'pt_BR' },
    components: [
      { type: 'header', parameters: [{ type: 'image', image: { id: 'header-media' } }] },
      { type: 'body', parameters: [{ type: 'text', parameter_name: 'nome', text: 'João' }] },
      {
        type: 'button',
        sub_type: 'quick_reply',
        index: '0',
        parameters: [{ type: 'payload', payload: 'confirm-123' }],
      },
    ],
  };
  await new AwsWhatsAppChatProvider(config).sendMessage(options, {
    template,
    context: { message_id: 'wamid.original' },
  });
  expect(messageFrom(send)).toMatchObject({ type: 'template', template, context: { message_id: 'wamid.original' } });
});

test('renders rich chat cards with the existing WhatsApp formatting', async () => {
  const rendered = await new AwsWhatsAppChatProvider(config).render({
    type: 'card',
    children: [{ type: 'text', content: '**Appointment** confirmed', style: 'plain' }],
  });
  expect(rendered.content).toBe('*Appointment* confirmed');
  expect(rendered.nativePayload).toEqual({});
});

test.each([
  { status: 403, name: 'AccessDeniedException' },
  { status: 400, name: 'InvalidParametersException' },
  { status: 429, name: 'ThrottledRequestException' },
])('propagates AWS HTTP $status errors without reporting success', async ({ status, name }) => {
  nock.disableNetConnect();
  const scope = nock('https://social-messaging.us-east-1.amazonaws.com')
    .persist()
    .post('/v1/whatsapp/send')
    .reply(status, { message: 'Simulated AWS failure' }, { 'x-amzn-errortype': name });
  try {
    await expect(new AwsWhatsAppChatProvider(config).sendMessage(options)).rejects.toMatchObject({
      name,
      $metadata: { httpStatusCode: status },
    });
    expect(scope.isDone()).toBe(true);
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
});
