import { SendWhatsAppMessageCommand, SocialMessagingClient } from '@aws-sdk/client-socialmessaging';
import { ChatProviderIdEnum } from '@novu/shared';
import { IChatOptions, ISendMessageSuccessResponse } from '@novu/stateless';
import { WithPassthrough } from '../../../utils/types';
import { WhatsAppBaseProvider } from '../whatsapp-business/whatsapp-base.provider';

export interface AwsWhatsAppConfig {
  region: string;
  originationPhoneNumberId: string;
  metaApiVersion: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
}

export class AwsWhatsAppChatProvider extends WhatsAppBaseProvider {
  id = ChatProviderIdEnum.AwsWhatsApp;
  private readonly client: SocialMessagingClient;

  constructor(private readonly config: AwsWhatsAppConfig) {
    super();
    if (!!config.accessKeyId !== !!config.secretAccessKey || (config.sessionToken && !config.accessKeyId)) {
      throw new Error('AWS WhatsApp requires both accessKeyId and secretAccessKey when supplying credentials');
    }

    this.client = new SocialMessagingClient({
      region: config.region,
      ...(config.accessKeyId && {
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
          sessionToken: config.sessionToken,
        },
      }),
    });
  }

  async sendMessage(
    options: IChatOptions,
    bridgeProviderData: WithPassthrough<Record<string, unknown>> = {}
  ): Promise<ISendMessageSuccessResponse> {
    const response = await this.client.send(
      new SendWhatsAppMessageCommand({
        originationPhoneNumberId: this.config.originationPhoneNumberId,
        metaApiVersion: this.config.metaApiVersion,
        message: Buffer.from(JSON.stringify(this.buildMessagePayload(options, bridgeProviderData))),
      })
    );

    return {
      id: response.messageId,
      date: new Date().toISOString(),
    };
  }
}
