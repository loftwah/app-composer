#!/usr/bin/env node
// Real local Jenkins LTS acceptance for the external-runner contract (#319).
//
// This starts one disposable Jenkins container on the operator's machine, has
// the real Jenkins job check out a temporary clone and invoke
// `examples/local-delivery-runner.sh --candidate`, then compares the produced
// receipt with the build identity Jenkins reports. It is local infrastructure:
// no hosted CI, no GitHub Actions, no scheduler, no new paid service.
//
// Everything this run creates is owned and removed: the container, the
// JENKINS_HOME directory, the temporary clone and the temporary root. The
// fixture image is kept as a local build cache and named in the output.
import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createOwnedRun} from './lib/owned-resources.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const image = 'composer-jenkins-fixture:lts-node22';
const dockerfile = join(repo, 'examples', 'jenkins', 'Dockerfile');
const evidenceSchema = 'composer.external-runner-evidence/1';
const receiptSchema = 'app-composer.delivery-receipt/1';
const user = 'composer-fixture';
const password = 'composer-fixture-token';

class FixtureError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'FixtureError';
    this.code = code;
  }
}

function parseArguments(argv) {
  const options = {keep: false, timeoutMinutes: 30, json: false};
  for (const argument of argv) {
    if (argument === '--help') return {help: true};
    if (argument === '--keep') options.keep = true;
    else if (argument === '--json') options.json = true;
    else if (argument.startsWith('--timeout-minutes=')) {
      const value = Number(argument.split('=')[1]);
      if (!Number.isFinite(value) || value < 5 || value > 90)
        throw new FixtureError('arguments', '--timeout-minutes must be between 5 and 90.');
      options.timeoutMinutes = value;
    } else throw new FixtureError('arguments', `Unsupported option ${argument}. Use --keep, --json, --help.`);
  }
  return options;
}

function docker(args, {timeout = 120000, allowFailure = false} = {}) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    timeout,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw new FixtureError('docker-unavailable', `Docker could not start: ${result.error.message}`);
  if (result.status !== 0 && !allowFailure)
    throw new FixtureError(
      'docker-failed',
      `docker ${args.slice(0, 2).join(' ')} exited ${result.status}: ${(result.stderr || result.stdout || '').trim().slice(0, 400)}`,
    );
  return result;
}

function localGit(args) {
  const result = spawnSync('git', args, {cwd: repo, encoding: 'utf8', timeout: 60000});
  if (result.status !== 0)
    throw new FixtureError('git-failed', `git ${args.join(' ')} failed: ${(result.stderr || '').trim().slice(0, 400)}`);
  return result.stdout.trim();
}

async function availablePort() {
  return await new Promise((accept, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const {port} = server.address();
      server.close(() => accept(port));
    });
  });
}

const sleep = ms => new Promise(accept => setTimeout(accept, ms));
const authorisation = () => `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
// Jenkins binds a CSRF crumb to the HTTP session, so the crumb request and the
// state-changing request must share the same JSESSIONID.
const cookieJar = new Map();
function rememberCookies(response) {
  for (const entry of response.headers.getSetCookie?.() ?? []) {
    const [pair] = entry.split(';');
    const index = pair.indexOf('=');
    if (index > 0) cookieJar.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
  }
}
const cookieHeader = () =>
  [...cookieJar].map(([name, value]) => `${name}=${value}`).join('; ');

async function jenkinsFetch(path, {method = 'GET', crumb = null, body = null, contentType = null, timeoutMs = 15000} = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const cookies = cookieHeader();
    const response = await fetch(`http://127.0.0.1:${path.port}${path.suffix}`, {
      method,
      headers: {
        Authorization: authorisation(),
        ...(cookies ? {Cookie: cookies} : {}),
        ...(crumb ? {[crumb.field]: crumb.value} : {}),
        ...(contentType ? {'Content-Type': contentType} : {}),
      },
      body,
      signal: controller.signal,
      redirect: 'manual',
    });
    rememberCookies(response);
    return response;
  } finally {
    clearTimeout(timer);
  }
}

const jobXml = `<?xml version='1.1' encoding='UTF-8'?>
<flow-definition plugin="workflow-job">
  <description>Local Composer external-runner acceptance (#319). Runs the repository delivery wrapper.</description>
  <keepDependencies>false</keepDependencies>
  <properties/>
  <definition class="org.jenkinsci.plugins.workflow.cps.CpsScmFlowDefinition" plugin="workflow-cps">
    <scm class="hudson.plugins.git.GitSCM" plugin="git">
      <configVersion>2</configVersion>
      <userRemoteConfigs>
        <hudson.plugins.git.UserRemoteConfig>
          <url>file:///workspace/source</url>
        </hudson.plugins.git.UserRemoteConfig>
      </userRemoteConfigs>
      <branches>
        <hudson.plugins.git.BranchSpec>
          <name>*/main</name>
        </hudson.plugins.git.BranchSpec>
      </branches>
      <doGenerateSubmoduleConfigurations>false</doGenerateSubmoduleConfigurations>
      <submoduleCfg class="empty-list"/>
      <extensions/>
    </scm>
    <scriptPath>examples/jenkins/Jenkinsfile</scriptPath>
    <lightweight>true</lightweight>
  </definition>
  <triggers/>
  <disabled>false</disabled>
</flow-definition>
`;

function writeJenkinsHome(home, port) {
  mkdirSync(join(home, 'init.groovy.d'), {recursive: true});
  // The job is seeded as the same config.xml Jenkins persists, so it loads in
  // the normal startup phase after the pipeline plugins register their XML
  // aliases. Creating it from init.groovy.d runs too early.
  mkdirSync(join(home, 'jobs', 'composer-delivery'), {recursive: true});
  writeFileSync(join(home, 'jobs', 'composer-delivery', 'config.xml'), jobXml);
  writeFileSync(
    join(home, 'init.groovy.d', '00-security.groovy'),
    `import jenkins.model.Jenkins
import hudson.security.HudsonPrivateSecurityRealm
import hudson.security.FullControlOnceLoggedInAuthorizationStrategy
import jenkins.model.JenkinsLocationConfiguration

def instance = Jenkins.get()
if (instance.getSecurityRealm() instanceof HudsonPrivateSecurityRealm == false) {
  def realm = new HudsonPrivateSecurityRealm(false)
  realm.createAccount('${user}', '${password}')
  instance.setSecurityRealm(realm)
  def strategy = new FullControlOnceLoggedInAuthorizationStrategy()
  strategy.setAllowAnonymousRead(false)
  instance.setAuthorizationStrategy(strategy)
  instance.setSlaveAgentPort(-1)
  JenkinsLocationConfiguration.get().setUrl('http://localhost:${port}/')
  JenkinsLocationConfiguration.get().save()
  instance.save()
  println('Composer fixture: local administrator and location configured')
}
`,
  );
}

async function waitForJenkins(port, deadline) {
  let last = '';
  while (Date.now() < deadline) {
    try {
      const response = await jenkinsFetch({port, suffix: '/api/json?tree=mode'});
      if (response.ok) return;
      last = `HTTP ${response.status}`;
    } catch (error) {
      last = error.message;
    }
    await sleep(3000);
  }
  throw new FixtureError('jenkins-timeout', `Jenkins did not become ready: ${last}`);
}

async function waitForBuild(port, deadline) {
  let build = null;
  while (Date.now() < deadline) {
    const response = await jenkinsFetch({
      port,
      suffix: '/job/composer-delivery/lastBuild/api/json?tree=number,building,result,duration,timestamp,url',
    });
    if (response.ok) {
      build = await response.json();
      if (build && build.number && build.building === false) return build;
    }
    await sleep(5000);
  }
  return build;
}

function tail(value, limit = 4000) {
  const text = String(value ?? '');
  return text.length > limit ? `[…]\n${text.slice(-limit)}` : text;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function boundedReceipt(receipt) {
  if (!receipt) return null;
  const copy = structuredClone(receipt);
  if (Array.isArray(copy.steps))
    copy.steps = copy.steps.map(step => ({
      id: step.id,
      label: step.label,
      command: step.command,
      state: step.state,
      durationMs: step.durationMs,
      ...(step.code ? {code: step.code} : {}),
    }));
  return copy;
}

function checkJenkinsReceipt(receipt, {build, headCommit}) {
  const checks = [];
  const add = (id, ok, detail) => checks.push({id, ok: Boolean(ok), detail: String(detail ?? '')});
  add('build-succeeded', build?.result === 'SUCCESS', `Jenkins result: ${build?.result ?? 'unknown'}`);
  add('receipt-contract', receipt?.schema === receiptSchema, `Schema: ${receipt?.schema ?? 'missing'}`);
  add('receipt-passed', receipt?.state === 'passed', `State: ${receipt?.state ?? 'missing'}`);
  add(
    'runner-recorded',
    receipt?.runner?.kind === 'jenkins' && receipt?.runner?.runId === build?.url,
    `Receipt runner ${receipt?.runner?.kind ?? 'missing'} · run ${receipt?.runner?.runId ?? 'missing'}`,
  );
  add(
    'source-commit-matches',
    receipt?.source?.commit === headCommit &&
      receipt.source.commit === receipt.source.originCommit &&
      receipt.source.dirty === false &&
      receipt.source.pushed === true,
    `Receipt ${receipt?.source?.commit ?? 'missing'} · clone ${headCommit}`,
  );
  const checksStep = receipt?.steps?.find(step => step?.id === 'local-checks');
  add(
    'checks-ran',
    checksStep?.state === 'passed' && Number(checksStep?.durationMs) > 0,
    `Local checks: ${checksStep?.state ?? 'missing'}`,
  );
  const buildStep = receipt?.steps?.find(step => step?.id === 'preview-build');
  add('candidate-built', buildStep?.state === 'passed', `Preview build: ${buildStep?.state ?? 'missing'}`);
  add(
    'artefact-identity',
    /^sha256:[a-f0-9]{64}$/.test(receipt?.candidate?.digest ?? '') &&
      /^sha256:[a-f0-9]{64}$/.test(receipt?.artefact?.digest ?? '') &&
      Number(receipt?.artefact?.files) > 0,
    `Candidate ${receipt?.candidate?.digest ?? 'missing'} · artefact ${receipt?.artefact?.digest ?? 'missing'} (${receipt?.artefact?.files ?? 0} files)`,
  );
  add(
    'no-upload',
    receipt?.candidate?.uploaded === false &&
      receipt?.release?.performed === false &&
      receipt?.verification?.performed === false,
    'Candidate only; no release and no live claim',
  );
  return checks;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`Real local Jenkins LTS acceptance for the external-runner contract.

Usage: node scripts/jenkins-fixture.mjs [--keep] [--json] [--timeout-minutes=N]

  --keep               Keep the temporary root for inspection (the container is always removed).
  --json               Print only the bounded evidence JSON.
  --timeout-minutes=N  Overall bound, 5 to 90 minutes. Default 30.

Requires a working local Docker daemon. Builds ${image} when it is absent.
No hosted CI, GitHub Actions, scheduler, new paid service or production upload.
`);
    return;
  }
  const startedAt = new Date().toISOString();
  const run = createOwnedRun({label: 'jenkins-fixture'});
  const nonce = randomBytes(6).toString('hex');
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'composer-jenkins-'));
  run.directory(root, {id: 'temporary-root'});
  const clone = join(root, 'source');
  const home = join(root, 'jenkins-home');
  const evidenceDirectory = join(repo, 'output', 'evidence');
  const deadline = Date.now() + options.timeoutMinutes * 60 * 1000;
  const container = `composer-jenkins-fixture-${nonce}`;
  const label = `composer-owned=jenkins-fixture-${nonce}`;
  let containerStarted = false;
  let containerLog = '';
  let imageBuilt = false;
  let evidence = null;
  let failure = null;
  try {
    const headCommit = localGit(['rev-parse', 'HEAD']);
    const branch = localGit(['branch', '--show-current']);
    const status = localGit(['status', '--porcelain']);
    const originCommit = localGit(['rev-parse', '--verify', 'origin/main']);
    if (branch !== 'main' || status !== '' || originCommit !== headCommit)
      throw new FixtureError(
        'source-not-ready',
        'Commit and push clean main before this fixture; the run must prove the exact pushed source.',
      );

    mkdirSync(home);
    chmodSync(home, 0o777);
    mkdirSync(evidenceDirectory, {recursive: true});

    if (docker(['image', 'inspect', '--format', '{{.Id}}', image], {allowFailure: true}).status !== 0) {
      docker(['build', '--file', dockerfile, '--tag', image, join(repo, 'examples', 'jenkins')], {
        timeout: 900000,
      });
      imageBuilt = true;
    }
    const imageId = docker(['image', 'inspect', '--format', '{{.Id}}', image]).stdout.trim();

    const cloneResult = spawnSync('git', ['clone', '--no-hardlinks', repo, clone], {
      encoding: 'utf8',
      timeout: 180000,
    });
    if (cloneResult.status !== 0)
      throw new FixtureError('clone-failed', `The temporary clone could not be created: ${(cloneResult.stderr || '').trim().slice(0, 300)}`);
    run.directory(clone, {id: 'temporary-clone'});

    const port = await availablePort();
    writeJenkinsHome(home, port);
    docker([
      'run',
      '--detach',
      '--name',
      container,
      '--label',
      label,
      '--publish',
      `127.0.0.1:${port}:8080`,
      '--volume',
      `${home}:/var/jenkins_home`,
      '--volume',
      `${clone}:/workspace/source:ro`,
      '--env',
      'JAVA_OPTS=-Djenkins.install.runSetupWizard=false -Djenkins.model.Jenkins.slaveAgentPort=-1',
      '--env',
      'JENKINS_OPTS=--httpPort=8080',
      image,
    ]);
    containerStarted = true;

    await waitForJenkins(port, Math.min(deadline, Date.now() + 600000));

    const crumbResponse = await jenkinsFetch({port, suffix: '/crumbIssuer/api/json'});
    if (!crumbResponse.ok)
      throw new FixtureError('crumb-unavailable', `Jenkins did not issue a CSRF crumb: HTTP ${crumbResponse.status}`);
    const issued = await crumbResponse.json();
    const crumb = {field: issued.crumbRequestField, value: issued.crumb};

    const jobResponse = await jenkinsFetch({port, suffix: '/job/composer-delivery/api/json?tree=name'});
    if (!jobResponse.ok) {
      containerLog = docker(['logs', '--tail', '400', container], {allowFailure: true}).stdout;
      throw new FixtureError(
        'job-missing',
        `The fixture job did not load: HTTP ${jobResponse.status}. ${tail(containerLog, 800)}`,
      );
    }

    const trigger = await jenkinsFetch({
      port,
      suffix: '/job/composer-delivery/build',
      method: 'POST',
      crumb,
    });
    if (trigger.status !== 201 && trigger.status !== 200)
      throw new FixtureError(
        'trigger-failed',
        `Jenkins did not accept the build trigger: HTTP ${trigger.status} ${tail(await trigger.text(), 300)}`,
      );

    const build = await waitForBuild(port, deadline);
    if (!build || build.building !== false)
      throw new FixtureError('build-timeout', 'The Jenkins build did not finish inside the selected bound.');

    const consoleResponse = await jenkinsFetch({port, suffix: `/job/composer-delivery/${build.number}/consoleText`});
    const consoleLog = consoleResponse.ok ? await consoleResponse.text() : '';
    const receiptPath = join(home, 'workspace', 'composer-delivery', 'evidence', 'candidate.json');
    const receipt = readJson(receiptPath);
    const checks = checkJenkinsReceipt(receipt, {build, headCommit});

    evidence = {
      schema: evidenceSchema,
      runner: 'jenkins',
      hosted: false,
      image: {tag: image, id: imageId, builtInThisRun: imageBuilt},
      jenkins: {
        job: 'composer-delivery',
        build: {
          number: build.number,
          url: build.url ?? null,
          result: build.result,
          durationMs: build.duration ?? null,
        },
      },
      source: {repository: 'loftwah/app-composer', branch, commit: headCommit},
      receipt: boundedReceipt(receipt),
      checks,
      consoleTail: tail(consoleLog),
      startedAt,
      finishedAt: new Date().toISOString(),
      cleanup: null,
    };
    const failed = checks.filter(check => !check.ok);
    if (failed.length)
      failure = new FixtureError(
        'acceptance-failed',
        `The Jenkins run did not satisfy: ${failed.map(check => `${check.id} (${check.detail})`).join('; ')}`,
      );
  } catch (error) {
    failure = error instanceof FixtureError ? error : new FixtureError('fixture-failed', error?.message ?? String(error));
  } finally {
    if (containerStarted) {
      const logs = docker(['logs', '--tail', '400', container], {allowFailure: true});
      containerLog = `${logs.stdout ?? ''}${logs.stderr ?? ''}`;
      docker(['rm', '--force', container], {allowFailure: true});
    }
    const leaked = containerStarted
      ? docker(['ps', '--all', '--quiet', '--filter', `label=${label}`], {allowFailure: true}).stdout.trim()
      : '';
    if (options.keep) console.error(`Temporary root kept at ${root}; the container is removed.`);
    const report = await run.teardown({reason: failure ? 'failed' : 'complete'});
    const cleanup = {
      containerRemoved: containerStarted ? leaked === '' : null,
      temporaryRootRemoved: !existsSync(root),
      teardown: report.status,
      teardownFailures: report.failures,
    };
    if (evidence) evidence.cleanup = cleanup;
    if (failure && !evidence) {
      evidence = {
        schema: evidenceSchema,
        runner: 'jenkins',
        hosted: false,
        image: {tag: image, builtInThisRun: imageBuilt},
        source: null,
        receipt: null,
        checks: [],
        consoleTail: '',
        startedAt,
        finishedAt: new Date().toISOString(),
        cleanup,
      };
    }
    if (!evidence) evidence = {schema: evidenceSchema, startedAt, finishedAt: new Date().toISOString(), cleanup};
    evidence.containerLogTail = tail(containerLog, 6000);
    evidence.error = failure ? {code: failure.code, message: failure.message} : null;
    const evidencePath = join(evidenceDirectory, `jenkins-external-runner-${nonce}.json`);
    try {
      writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
    } catch {
      /* The printed evidence remains authoritative. */
    }
    if (options.json) process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
    else {
      const lines = ['App Composer external runner — Jenkins LTS fixture'];
      lines.push(`Image: ${image}${imageBuilt ? ' (built in this run)' : ''}`);
      if (evidence.jenkins?.build)
        lines.push(
          `Jenkins: ${evidence.jenkins.build.url ?? evidence.jenkins.build.number} · ${evidence.jenkins.build.result} · ${Math.round((evidence.jenkins.build.durationMs ?? 0) / 1000)}s`,
        );
      if (evidence.source) lines.push(`Source: ${evidence.source.branch} @ ${evidence.source.commit.slice(0, 12)}`);
      for (const check of evidence.checks) lines.push(`${check.ok ? 'PASS' : 'FAIL'} ${check.id}: ${check.detail}`);
      if (evidence.receipt?.runner)
        lines.push(`Receipt runner: ${evidence.receipt.runner.kind} · ${evidence.receipt.runner.runId ?? 'no run id'}`);
      if (evidence.receipt?.artefact)
        lines.push(`Artefact: ${evidence.receipt.artefact.digest} · ${evidence.receipt.artefact.files} files`);
      lines.push(`Cleanup: container ${cleanup.containerRemoved === null ? 'not started' : cleanup.containerRemoved ? 'removed' : 'LEAKED'} · temporary root ${cleanup.temporaryRootRemoved ? 'removed' : 'present'}`);
      if (evidence.error) lines.push(`Result: ${evidence.error.code} — ${evidence.error.message}`);
      else lines.push('Result: passed');
      lines.push(`Evidence: ${evidencePath}`);
      process.stdout.write(`${lines.join('\n')}\n`);
    }
    if (failure) process.exitCode = 1;
  }
}

await main();
