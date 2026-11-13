import { AwsWhatsAppChatProvider } from '@novu/providers';
import { ChannelTypeEnum, ChatProviderIdEnum, ICredentials } from '@novu/shared';
import { BaseChatHandler } from './base.handler';

export class AwsWhatsAppHandler extends BaseChatHandler {
  constructor() {
    super(ChatProviderIdEnum.AwsWhatsApp, ChannelTypeEnum.CHAT);
  }

  buildProvider(credentials: ICredentials) {
    this.provider = new AwsWhatsAppChatProvider({
      accessKeyId: credentials.apiKey,
      secretAccessKey: credentials.secretKey,
      sessionToken: credentials.token,
      region: credentials.region,
      originationPhoneNumberId: credentials.phoneNumberIdentification,
      metaApiVersion: credentials.apiVersion,
    });
  }
}
