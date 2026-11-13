# AWS WhatsApp provider validation

Validated on 2026-11-13 with Node.js 22.23.5 in Docker and AWS End User Messaging Social in `sa-east-1`. Live sends used an authorized test recipient after opt-in. Account identifiers, credentials, recipient details and presigned URLs are omitted.

## Automated and Community checks

| Check | Result |
| --- | --- |
| Provider suites, including existing Meta WhatsApp regression coverage | 623 passed, 7 existing skips |
| Shared schemas and registry, including generated-schema drift | 444 passed, 6 existing skips |
| Backend factory and override validation | 58 passed |
| Worker Chat routing and phone endpoint deduplication | 27 passed |
| API integration E2E against MongoDB and Redis | 4 passed |
| Affected provider/shared/stateless/backend builds and dashboard type checks | Passed |
| Community dashboard integration create, read and update in Chromium | Passed |

API E2E covers credential encryption, API-key response redaction, creation without explicit keys, and credential/metadata updates. Provider coverage includes named/positional templates, headers/buttons, media IDs/URLs, location, contacts, reactions, interactive messages, rich-card rendering, override precedence, SigV4, UTF-8 encoding, incomplete credentials and HTTP 400/403/429 responses.

## Live AWS checks

- Recipient confirmed text, named approved template, document, image, audio, video, sticker and document URL delivery.
- Recipient confirmed API → queue → worker → AWS delivery; a phone endpoint plus subscriber phone produced one persisted sent message.
- Default environment credentials worked. The actual provider also ran without explicit keys under a real ECS Fargate task role and an EC2 instance profile with IMDSv2 required; both executions exited 0 and AWS accepted their sends.
- AWS accepted an approved positional template with image header and three dynamic quick-reply payloads, plus location, fictitious contact and interactive button messages. Delivery and button interaction were not confirmed for this additional batch or the role-based sends. A bounded non-destructive SQS sample did not yield matching delivery events.
- An invalid session token returned HTTP 403 (`UnrecognizedClientException`). Invalid template requests were accepted for asynchronous processing; their eventual Meta failure events were not established.
- All five media copies from confirmed earlier tests were deleted after correcting the test user's scoped IAM permissions. Source S3 objects were deleted and the test prefix was empty. The later template-header media ID remains recorded locally for cleanup after receipt confirmation. Temporary AWS compute, roles, repository and logging resources were removed.

## Load and remaining limits

A simulated HTTP transport exercised the actual provider and SDK for 3,500 signed requests with zero errors. At concurrency 1/10/50, measured throughput was 366/1,715/2,876 requests per second and p95 was 3/7/21 ms. These are local transport measurements, not production AWS/Meta quotas or queue/delivery capacity.

Enterprise validation and the full monorepo build are blocked by unavailable private `packages-enterprise` sources; affected Community builds passed separately. Three existing schema-generator lint errors were reproduced on the baseline. Mobile dashboard configuration retains the existing desktop prompt and clipped drawer.

Long-running IAM credential rotation, production throttling, live reactions and asynchronous delivery failure consumption remain unverified. Delivery webhooks, inbound conversations, template administration, consent storage and media uploading belong to the consuming application, outside this outbound provider.

## New-provider contribution guide review

Reviewed the official [Add a New Provider guide](https://docs.novu.co/community/add-a-new-provider?utm_campaign=github-contrib) on 2026-11-13 against the repository implementation.

| Guide requirement | Implementation |
| --- | --- |
| Provider in its channel directory, adjacent spec, channel export | Chat provider, spec and export present |
| Follow channel interface and BaseProvider override behavior | Shared WhatsApp base implements IChatProvider and preserves transform precedence |
| Credentials, provider enum and integration catalog | Registered; existing credential keys/interface/storage/encryption reused; missing apiVersion DTO field added |
| Framework enum and provider schema registry | Added AwsWhatsApp and generic Chat schema entry during this review |
| Handler and factory | Direct handler import and factory registration follow current Chat factory conventions; no handler barrel exists |
| Integration logo | Existing WhatsApp asset reused through catalog filenames and the dashboard square-icon alias |
| Build, unit tests and local application validation | Affected builds and Community checks recorded above; additional framework checks below |
| Fork, commit, push and upstream pull request | Fork/branch published; upstream PR creation remains restricted to repository collaborators |

The framework review added an execution test for an `aws-whatsapp` code-first Chat provider resolver. Focused framework tests: **71 passed, 2 existing skips**, no reported type errors. Framework build, package exports and circular-dependency checks passed. These are additional to the 1,156 prior test passes.

The guide does not describe a collaborator requirement or an acceptance action that removes GitHub's PR restriction. Its generic setup commands were not rerun; the existing Docker environment was used.
