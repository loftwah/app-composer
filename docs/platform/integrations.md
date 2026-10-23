# Enterprise integration contracts

Reviewed 23 October 2026, Australia/Melbourne. [#255](https://github.com/loftwah/app-composer/issues/255) owns connector qualification; [#254](https://github.com/loftwah/app-composer/issues/254) owns delivery/change/GitOps, and [#215](https://github.com/loftwah/app-composer/issues/215) retains the incident/responder demonstration. The first platform journey does not require this whole catalogue.

**Current support:** one trusted-host PagerDuty-shaped transport is qualified against a local HTTP receiver. No vendor connector, account, licence, cloud network or production notification was exercised in this lane. All other paths below are provider-documented candidates. No connector transfers approval, cloud authority or remediation authority through an imported record.

## Local operational proof and trusted-host interface

`lib/platform/integration-adapter.mjs` exports `createIntegrationAdapter`. Trusted host code configures fixed `change` and/or `incident` destinations and their routing keys once. Payloads accept bounded operation/team/app/environment, exact 40-character source SHA, release identity, outcome, summary and optional plan digest/policy revision. Incident events additionally require `incidentId` and explicit `trigger`, `acknowledge` or `resolve`. No payload field can select an endpoint, credential, callback, severity, HTTP method, arbitrary extra data or command. Do not expose the factory configuration through a public route, imported recipe or model tool argument.

The change channel requires `/v2/change/enqueue`; the incident channel requires `/v2/enqueue`. Transport uses HTTPS, omits cookies, refuses redirects, reads a maximum 4 KiB acknowledgement and times out after at most 30 seconds (default 5 seconds). Loopback HTTP at `127.0.0.1` requires an explicit fixture setting. Destination configuration is copied so a later caller mutation cannot retarget it. This is a local Node runner module, not a browser SDK.

Each event has a deterministic ID derived from channel, operation/release/source/scopes/outcome/action and optional evidence identities. Summary wording does not change that ID. Alert deduplication binds team/app/environment/incident so a recovery operation can resolve the same incident. Changes and incidents remain distinct. The same incident routing key must remain selected across trigger/acknowledge/resolve, as required by [PagerDuty's alert contract](https://docs.pagerduty.com/developer/send-alert-event).

A valid `202` acknowledgement means **accepted for asynchronous processing**. It does not prove a displayed change, incident routing, on-call notification or completed recovery. Explicit client rejections return `rejected`; connection loss, 408/409, redirects, server failure, malformed/oversized or mismatched acknowledgements return `unknown`. There is no retry loop. The caller must persist intent/event ID and outcome, prevent concurrent or repeated delivery and reconcile an unknown outcome before any deliberate retry. Change IDs are correlation data, not a vendor exactly-once guarantee. A repeated trigger after resolution can create another incident.

Run `node --test tests/platform-integrations.test.mjs` and `node scripts/platform-qualification.mjs` (see [runtime qualification](runtime-qualification.md) for selecting existing dependencies). The inspectable receiver writes redacted NDJSON in one owned temporary root. Three accepted requests demonstrate a release change, controlled alert and independently represented recovery; a fourth is written before the connection closes and remains `unknown`, received exactly once. The script emits these bounded records and IDs before its `finally` cleanup removes the root. No routing key appears in the report. This proves adapter-to-fixture delivery, not vendor execution or the full #215 responder.

Before any vendor enablement: select the actual service, account/region, integration key and permission, prove ingestion/routing with authorised synthetic events, observe the vendor's records and retain the exact candidate/outcome links. An incident trigger can notify people and needs that explicit sending authority. A change event is informational and cannot approve a release. Resolve only after independently verified recovery; this transport does not perform the check or remediation itself. [PagerDuty distinguishes alert/change event behaviour](https://docs.pagerduty.com/developer/events-api-v2-overview).

## Secrets and execution

### HashiCorp Vault

- **Purpose/direction:** central secret service; trusted runner/workload authenticates to Vault, reads a permitted secret and reports only lease status/evidence to Composer.
- **Authentication/authority/network:** operator-selected workload auth/token and narrow path policy over a verified private/TLS API. Vault's permission grants secret access; Composer membership does not. A Worker needs its own qualified bootstrap identity and reachability.
- **Version/entitlement/data/failure/status:** pin server/auth/secrets-engine versions and any Enterprise/HCP capabilities before use; none selected here. Keep plaintext out of specs, logs and artifacts. Dynamic leases need bounded renewal/revocation; stop safely on expiry, denial or uncertain renewal. Copying a value into configuration does not maintain its lease. **Provider-documented; unimplemented in Composer.** [Vault lease lifecycle](https://developer.hashicorp.com/vault/docs/concepts/lease).

### Ansible Vault

- **Purpose/direction:** encrypted files/variables flow from reviewed source into trusted execution; only non-sensitive task outcomes return.
- **Authentication/authority/network:** runner obtains an operator-selected vault password/secret-manager identity. File decryption grants access to plaintext, not infrastructure permission. Network access belongs to the separate playbook/secret manager.
- **Version/entitlement/data/failure/status:** pin `ansible-core`, vault format and password tooling; no version/runner selected. Encryption protects data at rest; use protected storage, `no_log`, careful diff/editor handling and cleanup for decrypted data. Wrong/unavailable password stops execution; never log plaintext or fall back to another identity. **Provider-documented; unimplemented.** [Ansible Vault](https://docs.ansible.com/projects/ansible/latest/vault_guide/vault.html).

### Ansible Playbooks

- **Purpose/direction:** reviewed runner executes a pinned playbook against fixed inventory, returning task/check/change outcomes.
- **Authentication/authority/network:** scoped SSH/WinRM/cloud identity, controlled host inventory and private route. Request data cannot become shell text or select arbitrary hosts. Playbook and module owners define effects.
- **Version/entitlement/data/failure/status:** pin core/collection/module versions and any Automation Platform entitlement; none qualified. Redact facts/diffs, control temporary files and record partial hosts. Check mode depends on modules and can be overridden by `check_mode:false`; it is not proof of an applied change or universal no-write behaviour. Stop and reconcile partial changes. **Provider-documented; unimplemented.** [Check/diff mode](https://docs.ansible.com/projects/ansible/latest/playbook_guide/playbooks_checkmode.html).

### Jenkins

- **Purpose/direction:** trusted host submits one allowlisted job/candidate; queue, build, artifact and test/verification evidence return.
- **Authentication/authority/network:** existing controller API token/service principal, fixed HTTPS job and least-privilege job permissions. A requester cannot edit the trusted credential-bearing job. Private controllers require actual runner reachability; a browser is not the runner.
- **Version/entitlement/data/failure/status:** pin controller/LTS, plugin and agent versions; no accessible selected controller/job was provided or contacted. Protect logs/artifacts, constrain parameters and separate untrusted build credentials from deployment credentials. Queue acceptance is not build success. Preserve an unknown submission and reconcile queue/build ID before retry. **Provider-documented; no Composer job executed.** [Remote API](https://www.jenkins.io/doc/book/using/remote-access-api/), [untrusted source and credentials](https://www.jenkins.io/doc/book/security/securing-org-folders-and-multibranch-pipelines/).

### Terraform

- **Purpose/direction:** reviewed module and exact candidate produce a saved plan, policy decision and protected apply; resource/state identities return.
- **Authentication/authority/network:** scoped provider identities held only by trusted apply runner; selected API/private endpoints and protected state backend. Declare ownership per resource/property with Wrangler, Jenkins and reconcilers.
- **Version/entitlement/data/failure/status:** local CLI 1.14.8 was observed, without running init/plan/apply. Pin provider/module/lockfile versions and HCP policy entitlements separately. Plans/state can contain secrets; lock and encrypt supported backends. On partial/unknown apply inspect state and provider resources before retry or adoption. **CLI inventory only; no Composer Terraform adapter.** [Providers](https://developer.hashicorp.com/terraform/language/block/provider), [state/backends and locking](https://developer.hashicorp.com/terraform/language/state/backends).

## Security evidence

### Snyk

- **Purpose/direction:** trusted build environment sends the exact candidate's eligible source/dependency/IaC/container inputs to the selected scan and returns scoped findings/evidence.
- **Authentication/authority/network:** selected Snyk org/token and product permissions over the approved regional API. Findings inform enforced policy; a scan record cannot grant a release exception.
- **Version/entitlement/data/failure/status:** pin CLI/plugin and selected product/plan; no Snyk tool/account/scan qualified. Source/manifests/image metadata may leave the build boundary; review scope, retention and residency. Distinguish findings from scan/transport failure, unsupported projects and stale results; no failed scan becomes a clean pass. **Provider-documented; unimplemented.** [CLI scan modes](https://docs.snyk.io/developer-tools/snyk-cli/cli-commands-and-options-summary), [Jenkins scanner outcomes](https://www.jenkins.io/doc/pipeline/steps/snyk-security-scanner/).

### Wiz

- **Purpose/direction:** permitted cloud/DNS/exposure data enters Wiz; asset/finding context returns for security review.
- **Authentication/authority/network:** operator-selected Wiz connector/service principal and explicit provider read scopes over approved API paths. Security operations owns remediation; a finding is not deployment authority.
- **Version/entitlement/data/failure/status:** select actual Wiz product/connector version, licence and enabled resource types; none qualified. Minimise inventory/identity exposure and document location/retention. Permission failures or missing findings mean coverage unknown, not clean. Public integration documentation covers Cloudflare DNS/exposure and AI endpoints; no full Worker/D1/KV/Queues posture/runtime coverage is established. **Provider-documented; unimplemented.** [Wiz's documented Cloudflare scope](https://www.wiz.io/blog/wiz-cloudflare-ai-security-integration). Record resource types, findings, collection latency and blind spots before any support claim.

## Telemetry and data

### Splunk

- **Purpose/direction:** selected Cloudflare logs → Splunk HEC; appropriate OTLP → selected Splunk product/collector is a separate path. Queries/evidence may flow back.
- **Authentication/authority/network:** host-held HEC/collector token, fixed TLS destination and allowed index/tenant. Cloudflare's exporter needs its own network reachability; a Worker VPC binding proves neither exporter reachability nor access.
- **Version/entitlement/data/failure/status:** pin receiver/collector versions, dataset/schema and retention; verify Cloudflare/Splunk plan entitlement. None configured. Redact logs and keep complete security audit distinct from sampled telemetry. Monitor rejected batches/backpressure/delivery gaps; no accepted batch implies searchable completeness. **Provider-documented; unimplemented.** [Splunk HEC Logpush](https://developers.cloudflare.com/logs/logpush/logpush-job/enable-destinations/splunk/), [Workers Logpush entitlement](https://developers.cloudflare.com/workers/observability/logs/logpush/).

### OpenSearch

- **Purpose/direction:** logs/traces → OTel Collector → Data Prepper → OpenSearch; query results provide operating context.
- **Authentication/authority/network:** selected collector credentials/mTLS and restricted ingestion/index permissions over actual reachable TLS endpoints. Do not copy insecure sample configurations into production.
- **Version/entitlement/data/failure/status:** the inspected APM ingestion page says introduced in **3.6**; pin OpenSearch, Data Prepper and Collector together. No stack installed. Configure minimisation/retention and inspect buffers, rejected data and indexing lag. Workers native OTLP currently covers logs/traces, not infrastructure/custom metrics. **Provider-documented candidate pipeline; unimplemented.** [Ingestion architecture](https://docs.opensearch.org/latest/observing-your-data/apm/configuring-telemetry-ingestion/), [Workers OTLP coverage](https://developers.cloudflare.com/workers/observability/opentelemetry-export/).

### ClickHouse

- **Purpose/direction:** eligible event batches/query requests → selected ClickHouse service; bounded results → authorised application/report.
- **Authentication/authority/network:** server-held limited database user/token over fixed HTTPS endpoint; browsers receive no database credential. Private service reachability must be tested from the actual runtime.
- **Version/entitlement/data/failure/status:** official docs distinguish Node `@clickhouse/client` from Workers-capable `@clickhouse/client-web`; inspected compatibility table lists client **1.12.0** with ClickHouse **24.8+**. No version installed or cloud plan selected. Define schema, tenant access, retention and duplicate strategy. Batch timeout may follow a committed insert; reconcile stable batch IDs before retry. **Provider-documented; unimplemented.** [Official JS clients](https://clickhouse.com/docs/integrations/language-clients/js), [separate Cloudflare log pipeline](https://clickhouse.com/docs/clickstack/integration-examples/cloudflare).

### Kafka

- **Purpose/direction:** bounded events → qualified HTTPS REST gateway/bridge → Kafka topic; consumers/read models are separate services.
- **Authentication/authority/network:** selected gateway auth, broker SASL/TLS and topic ACLs, with private routing/egress actually tested. A reachable TCP port does not establish broker discovery, native client support or long-lived consumer suitability in Workers.
- **Version/entitlement/data/failure/status:** select broker/gateway/REST v2 or v3/schema registry versions and applicable Confluent entitlement; none tested. Define event keys, schema, retention, tenant boundaries and replay. Inspect **per-record errors even after HTTP success**, reconcile offsets/IDs after uncertain delivery and surface lag/dead letters. **Provider-documented; unimplemented.** [REST APIs and delivery responses](https://docs.confluent.io/platform/current/kafka-rest/api.html).

## Change and operations

### ServiceNow

- **Purpose/direction:** exact service/candidate/test/recovery context → authoritative change workflow; current approval/window/result → trusted release gate.
- **Authentication/authority/network:** selected instance OAuth/service account and narrow change/CMDB roles; fixed TLS instance, actual runner connectivity and authenticated/ordered inbound events. Reconcile current authority at release, not a cached badge.
- **Version/entitlement/data/failure/status:** inspected Change Velocity documentation is **Zurich**; unversioned Jenkins documentation currently identifies **Brazil**. Match the actual instance, installed plugin, Jenkins integration and licence before use; none configured. Restrict ticket data, protect approval identities and bind exact plan/candidate. Expired, revoked, changed or unavailable approval blocks the relevant release without replaying effects. **Provider-documented; unimplemented.** [Change Velocity](https://www.servicenow.com/docs/r/zurich/it-service-management/devops-change-velocity/dev-ops-change-acceleration.html), [Jenkins integration](https://www.servicenow.com/docs/r/it-service-management/devops-change-velocity/jenkins-integration-dev-ops.html).

### PagerDuty

- **Purpose/direction:** release change → separate change endpoint; verified actionable condition → incident trigger; independently verified recovery → resolve; vendor records/routing confirmation remain separate evidence.
- **Authentication/authority/network:** host-selected Events API v2 routing key and fixed TLS service endpoints. Incident response/escalation belongs to the selected service. No event grants permission to remediate; sending alerts can notify people.
- **Version/entitlement/data/failure/status:** Events API **v2** contract; real account/region/service, plan and notification entitlement unverified. Transmit bounded operation/release context, never credentials/record bodies. Keep accepted/processed/notified/recovered states separate; preserve `unknown`, dedup identities and same routing key across incident actions. **Adapter-to-local-fixture qualified only**, as described above. [Change endpoint](https://docs.pagerduty.com/developer/send-change-event), [alert endpoint/actions](https://docs.pagerduty.com/developer/send-alert-event).

### Argo CD

- **Purpose/direction:** reviewed Git/Helm/Kustomize desired state → Argo → Kubernetes; sync/health/revision evidence → Composer.
- **Authentication/authority/network:** fixed repository credentials, restricted Argo project/destinations and Kubernetes service identity over private APIs. Requesters cannot edit the trusted reconciler or widen cluster scope.
- **Version/entitlement/data/failure/status:** pin Argo/Kubernetes/Helm versions and selected managed-service entitlement; no Argo or cluster tested. Git contains references rather than plaintext secrets; protect history and audit access. Auto-sync/self-heal can reverse out-of-band recovery; change desired revision or use an audited emergency procedure. Argo documents rollback restrictions with automated sync. Workers needs a separate qualified delivery adapter, not a Kubernetes logo. **Provider-documented; unimplemented.** [Argo scope](https://argoproj.github.io/cd/), [auto-sync/rollback](https://argo-cd.readthedocs.io/en/stable/user-guide/auto_sync/), [sync windows](https://argo-cd.readthedocs.io/en/latest/user-guide/sync_windows/).

## Acceptance record for any future connector

Record actual Composer source/artifact, selected vendor/account/environment, protocol and receiver version, entitlements, configured scopes, credential custody, network path, permitted data/retention, exact commands, sent/received identifiers, independent receiver outcome, failure/reconciliation evidence and owned-resource cleanup. Keep these in #11 and the owning issue. Provider-documented capabilities remain candidates until their configured receiving system has been inspected. Imported receipts are observations, never permission grants.
