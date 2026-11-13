import { AwsWhatsAppChatProvider } from '@novu/providers';
import { ChannelTypeEnum, ChatProviderIdEnum } from '@novu/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AwsWhatsAppHandler } from './aws-whatsapp.handler';

vi.mock('@novu/providers', () => ({ AwsWhatsAppChatProvider: vi.fn(class {}), cardToFallbackMarkdown: vi.fn() }));

describe('AwsWhatsAppHandler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('handles only the AWS WhatsApp chat integration', () => {
    const handler = new AwsWhatsAppHandler();
    expect(handler.canHandle(ChatProviderIdEnum.AwsWhatsApp, ChannelTypeEnum.CHAT)).toBe(true);
    expect(handler.canHandle(ChatProviderIdEnum.WhatsAppBusiness, ChannelTypeEnum.CHAT)).toBe(false);
    expect(handler.canHandle(ChatProviderIdEnum.AwsWhatsApp, ChannelTypeEnum.SMS)).toBe(false);
  });

  it('maps stored credentials to the AWS client configuration', () => {
    new AwsWhatsAppHandler().buildProvider({
      apiKey: 'access-key',
      secretKey: 'secret-key',
      token: 'session-token',
      region: 'us-east-1',
      phoneNumberIdentification: 'phone-number-id-example',
      apiVersion: 'v22.0',
    });

    expect(AwsWhatsAppChatProvider).toHaveBeenCalledWith({
      accessKeyId: 'access-key',
      secretAccessKey: 'secret-key',
      sessionToken: 'session-token',
      region: 'us-east-1',
      originationPhoneNumberId: 'phone-number-id-example',
      metaApiVersion: 'v22.0',
    });
  });
});
