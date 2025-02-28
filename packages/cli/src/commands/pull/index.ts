import chalk from 'chalk';
import { join } from 'path';
import Client from '../../util/client';
import type { ProjectEnvTarget, ProjectLinked } from '@vercel-internals/types';
import { emoji, prependEmoji } from '../../util/emoji';
import { parseArguments } from '../../util/get-args';
import stamp from '../../util/output/stamp';
import { VERCEL_DIR, VERCEL_DIR_PROJECT } from '../../util/projects/link';
import { writeProjectSettings } from '../../util/projects/project-settings';
import { envPullCommandLogic } from '../env/pull';
import {
  isValidEnvTarget,
  getEnvTargetPlaceholder,
} from '../../util/env/env-target';
import { ensureLink } from '../../util/link/ensure-link';
import humanizePath from '../../util/humanize-path';

import { help } from '../help';
import { pullCommand } from './command';
import { type EnvCommandFlags } from '../env/command';
import parseTarget from '../../util/parse-target';
import { getFlagsSpecification } from '../../util/get-flags-specification';
import handleError from '../../util/handle-error';
import { PullTelemetryClient } from '../../util/telemetry/commands/pull';

async function pullAllEnvFiles(
  environment: string,
  client: Client,
  link: ProjectLinked,
  flags: EnvCommandFlags,
  cwd: string
): Promise<number> {
  const environmentFile = `.env.${environment}.local`;

  await envPullCommandLogic(
    client,
    client.output,
    join('.vercel', environmentFile),
    !!flags['--yes'],
    environment,
    link,
    flags['--git-branch'],
    cwd,
    'vercel-cli:pull'
  );

  return 0;
}

export function parseEnvironment(
  environment = 'development'
): ProjectEnvTarget {
  if (!isValidEnvTarget(environment)) {
    throw new Error(
      `environment "${environment}" not supported; must be one of ${getEnvTargetPlaceholder()}`
    );
  }
  return environment;
}

export default async function main(client: Client) {
  let parsedArgs = null;

  const flagsSpecification = getFlagsSpecification(pullCommand.options);

  // Parse CLI args
  try {
    parsedArgs = parseArguments(client.argv.slice(2), flagsSpecification);
  } catch (error) {
    handleError(error);
    return 1;
  }

  const { output } = client;

  if (parsedArgs.flags['--help']) {
    output.print(help(pullCommand, { columns: client.stderr.columns }));
    return 2;
  }

  let cwd = parsedArgs.args[1] || client.cwd;
  const autoConfirm = Boolean(parsedArgs.flags['--yes']);
  const isProduction = Boolean(parsedArgs.flags['--prod']);
  const environment =
    parseTarget({
      output: client.output,
      flagName: 'environment',
      flags: parsedArgs.flags,
    }) || 'development';

  const telemetryClient = new PullTelemetryClient({
    opts: {
      output: client.output,
      store: client.telemetryEventStore,
    },
  });

  telemetryClient.trackCliFlagYes(autoConfirm);
  telemetryClient.trackCliFlagProd(isProduction);
  telemetryClient.trackCliOptionGitBranch(parsedArgs.flags['--git-branch']);
  telemetryClient.trackCliOptionEnvironment(parsedArgs.flags['--environment']);

  const returnCode = await pullCommandLogic(
    client,
    cwd,
    autoConfirm,
    environment,
    parsedArgs.flags
  );
  return returnCode;
}

export async function pullCommandLogic(
  client: Client,
  cwd: string,
  autoConfirm: boolean,
  environment: string,
  flags: EnvCommandFlags
): Promise<number> {
  const link = await ensureLink('pull', client, cwd, { autoConfirm });
  if (typeof link === 'number') {
    return link;
  }

  const { project, org, repoRoot } = link;

  if (repoRoot) {
    cwd = join(repoRoot, project.rootDirectory || '');
  }

  client.config.currentTeam = org.type === 'team' ? org.id : undefined;

  const pullResultCode = await pullAllEnvFiles(
    environment,
    client,
    link,
    flags,
    cwd
  );
  if (pullResultCode !== 0) {
    return pullResultCode;
  }

  client.output.print('\n');
  client.output.log('Downloading project settings');
  const isRepoLinked = typeof repoRoot === 'string';
  await writeProjectSettings(cwd, project, org, isRepoLinked);

  const settingsStamp = stamp();
  client.output.print(
    `${prependEmoji(
      `Downloaded project settings to ${chalk.bold(
        humanizePath(join(cwd, VERCEL_DIR, VERCEL_DIR_PROJECT))
      )} ${chalk.gray(settingsStamp())}`,
      emoji('success')
    )}\n`
  );

  return 0;
}
