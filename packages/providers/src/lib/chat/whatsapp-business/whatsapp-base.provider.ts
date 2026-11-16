import { ENDPOINT_TYPES } from '@novu/shared';
import {
  CardElement,
  ChannelTypeEnum,
  IChatOptions,
  IChatProvider,
  IChatRenderResult,
  ISendMessageSuccessResponse,
  isChannelDataOfType,
} from '@novu/stateless';
import { BaseProvider, CasingEnum } from '../../../base.provider';
import { WithPassthrough } from '../../../utils/types';
import { cardToWhatsAppText } from './card-render.utils';
import { WhatsAppMessageTypeEnum } from './consts/whatsapp-business.enum';

export abstract class WhatsAppBaseProvider extends BaseProvider implements IChatProvider {
  abstract id: string;
  protected casing: CasingEnum = CasingEnum.SNAKE_CASE;
  channelType = ChannelTypeEnum.CHAT as ChannelTypeEnum.CHAT;

  abstract sendMessage(
    options: IChatOptions,
    bridgeProviderData?: WithPassthrough<Record<string, unknown>>
  ): Promise<ISendMessageSuccessResponse>;

  /**
   * Rich Chat: WhatsApp has no native card payload, so degrade the `CardElement` to WhatsApp-flavored
   * text (`*bold*`, `_italic_`, `~strike~`; links rendered as `label (url)` since it has no link markup).
   */
  async render(card: CardElement): Promise<IChatRenderResult> {
    return {
      nativePayload: {},
      content: cardToWhatsAppText(card),
      validation: [],
    };
  }

  protected buildMessagePayload(
    options: IChatOptions,
    bridgeProviderData: WithPassthrough<Record<string, unknown>> = {}
  ): Record<string, unknown> {
    if (!isChannelDataOfType(options.channelData, ENDPOINT_TYPES.PHONE)) {
      throw new Error('Invalid channel data for WhatsappBusiness provider');
    }

    const { phoneNumber } = options.channelData.endpoint;
    const type = this.defineMessageType(options, bridgeProviderData);

    const merged = this.transform(bridgeProviderData, this.defineMessagePayload(options, phoneNumber, type))
      .body as Record<string, unknown>;

    return this.projectMessagePayload(merged, type, options);
  }

  private defineMessagePayload(options: IChatOptions, phoneNumber: string, type: WhatsAppMessageTypeEnum) {
    const basePayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneNumber,
      type,
    };

    if (type === WhatsAppMessageTypeEnum.TEXT) {
      const textData = options.customData?.text;

      return {
        ...basePayload,
        text: {
          body: textData?.body ?? options.content,
          preview_url: textData?.preview_url ?? false,
        },
      };
    }

    const payloadData = options.customData?.[type];

    if (payloadData === undefined) {
      return basePayload;
    }

    return {
      ...basePayload,
      [type]: payloadData,
    };
  }

  /**
   * Keep shared Message fields from the merge (`context`, `recipient_type`, …) and strip sibling
   * typed bodies so an image override cannot leave a stray `text` / `template` key behind.
   */
  private projectMessagePayload(merged: Record<string, unknown>, type: WhatsAppMessageTypeEnum, options: IChatOptions) {
    const payload: Record<string, unknown> = { ...merged, type };

    for (const key of Object.values(WhatsAppMessageTypeEnum)) {
      if (key !== type) {
        delete payload[key];
      }
    }

    if (type === WhatsAppMessageTypeEnum.TEXT && payload.text == null) {
      payload.text = {
        body: options.content,
        preview_url: false,
      };
    }

    return payload;
  }

  private defineMessageType(
    options: IChatOptions,
    bridgeProviderData: WithPassthrough<Record<string, unknown>>
  ): WhatsAppMessageTypeEnum {
    const { _passthrough = {}, ...bridgeData } = bridgeProviderData;
    const passthroughBody = (_passthrough.body || {}) as Record<string, unknown>;

    // Highest priority first — matches transform merge order. Resolve each source
    // fully (explicit type, then typed keys) before falling through to a lower one.
    const sources = [passthroughBody, bridgeData as Record<string, unknown>, options.customData].filter(
      (source): source is Record<string, unknown> => source != null && Object.keys(source).length > 0
    );

    for (const source of sources) {
      const typeFromSource = this.resolveTypeFromSource(source);

      if (typeFromSource) {
        return typeFromSource;
      }
    }

    return WhatsAppMessageTypeEnum.TEXT;
  }

  private resolveTypeFromSource(source: Record<string, unknown>): WhatsAppMessageTypeEnum | undefined {
    if (typeof source.type === 'string' && this.isWhatsAppMessageType(source.type)) {
      return source.type;
    }

    for (const key of Object.values(WhatsAppMessageTypeEnum)) {
      if (key === WhatsAppMessageTypeEnum.TEXT) {
        continue;
      }

      if (key in source) {
        return key;
      }
    }

    return undefined;
  }

  private isWhatsAppMessageType(value: string): value is WhatsAppMessageTypeEnum {
    return (Object.values(WhatsAppMessageTypeEnum) as string[]).includes(value);
  }
}
