import { ChatProviderIdEnum } from '@novu/shared';
import { IChatOptions, ISendMessageSuccessResponse } from '@novu/stateless';
import { AxiosInstance } from 'axios';
import { createProviderHttpClient } from '../../../utils/http';
import { WithPassthrough } from '../../../utils/types';
import { ISendMessageRes } from './types/whatsapp-business.types';
import { WhatsAppBaseProvider } from './whatsapp-base.provider';

export class WhatsappBusinessChatProvider extends WhatsAppBaseProvider {
  id = ChatProviderIdEnum.WhatsAppBusiness;
  private readonly axiosClient: AxiosInstance;
  private readonly baseUrl = 'https://graph.facebook.com/v22.0/';

  constructor(
    private config: {
      accessToken: string;
      phoneNumberIdentification: string;
    }
  ) {
    super();
    this.axiosClient = createProviderHttpClient({
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async sendMessage(
    options: IChatOptions,
    bridgeProviderData: WithPassthrough<Record<string, unknown>> = {}
  ): Promise<ISendMessageSuccessResponse> {
    const { data } = await this.axiosClient.post<ISendMessageRes>(
      `${this.baseUrl + this.config.phoneNumberIdentification}/messages`,
      this.buildMessagePayload(options, bridgeProviderData)
    );

    return {
      id: data.messages[0].id,
      date: new Date().toISOString(),
    };
  }
}
