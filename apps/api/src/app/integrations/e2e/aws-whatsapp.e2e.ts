import { IntegrationRepository } from '@novu/dal';
import { ChannelTypeEnum, ChatProviderIdEnum } from '@novu/shared';
import { UserSession } from '@novu/testing';
import { expect } from 'chai';

describe('AWS WhatsApp integration #novu-v2', () => {
  let session: UserSession;
  const repository = new IntegrationRepository();
  const credentials = {
    apiKey: 'aws-test-access-key',
    secretKey: 'aws-test-secret-key',
    token: 'aws-test-session-token',
    region: 'sa-east-1',
    phoneNumberIdentification: 'phone-number-id-01234567890123456789012345678901',
    apiVersion: 'v23.0',
  };

  beforeEach(async () => {
    session = new UserSession();
    await session.initialize();
  });

  async function create(integrationCredentials: Partial<typeof credentials> = credentials) {
    return session.testAgent.post('/v1/integrations').send({
      providerId: ChatProviderIdEnum.AwsWhatsApp,
      channel: ChannelTypeEnum.CHAT,
      identifier: 'aws-whatsapp-test',
      credentials: integrationCredentials,
      active: true,
      check: false,
    });
  }

  it('persists all AWS settings and encrypts access keys and the session token', async () => {
    const { body, status } = await create();
    expect(status).to.equal(201);
    expect(body.data.providerId).to.equal(ChatProviderIdEnum.AwsWhatsApp);

    const stored = await repository.findOne({ _id: body.data._id, _environmentId: session.environment._id });
    expect(stored.credentials.apiKey).not.to.equal(credentials.apiKey);
    expect(stored.credentials.secretKey).not.to.equal(credentials.secretKey);
    expect(stored.credentials.token).not.to.equal(credentials.token);
    expect(stored.credentials.apiVersion).to.equal('v23.0');
    expect(stored.credentials.phoneNumberIdentification).to.equal(credentials.phoneNumberIdentification);

    const result = await session.testAgent.get('/v1/integrations');
    const integration = result.body.data.find((item) => item._id === body.data._id);
    expect(integration.credentials).to.include(credentials);
  });

  it('allows the AWS default credential chain without stored access keys', async () => {
    const { apiKey, secretKey, token, ...roleCredentials } = credentials;
    const { body, status } = await create(roleCredentials);
    expect(status).to.equal(201);
    expect(body.data.providerId).to.equal(ChatProviderIdEnum.AwsWhatsApp);
  });

  it('does not expose AWS credentials to environment API-key callers', async () => {
    const { body } = await create();
    const result = await session.testAgent.get('/v1/integrations').set('authorization', `ApiKey ${session.apiKey}`);
    const integration = result.body.data.find((item) => item._id === body.data._id);
    expect(integration.credentials).to.deep.equal({});
    expect(JSON.stringify(result.body)).not.to.include(credentials.secretKey);
    expect(JSON.stringify(result.body)).not.to.include(credentials.token);
  });

  it('updates credentials and metadata without losing the origination phone number', async () => {
    const { body } = await create();
    const next = { ...credentials, secretKey: 'rotated-test-secret', token: 'rotated-test-token', apiVersion: 'v22.0' };
    const updated = await session.testAgent.put(`/v1/integrations/${body.data._id}`).send({ credentials: next });
    expect(updated.status).to.equal(200);
    const result = await session.testAgent.get('/v1/integrations');
    const integration = result.body.data.find((item) => item._id === body.data._id);
    expect(integration.credentials).to.include(next);
  });
});
