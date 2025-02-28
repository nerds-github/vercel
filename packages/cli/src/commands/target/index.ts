import Client from '../../util/client';
import { parseArguments } from '../../util/get-args';
import getInvalidSubcommand from '../../util/get-invalid-subcommand';
import { help } from '../help';
import list from './list';
import { targetCommand } from './command';
import { getFlagsSpecification } from '../../util/get-flags-specification';
import handleError from '../../util/handle-error';
import { TargetTelemetryClient } from '../../util/telemetry/commands/target';

const COMMAND_CONFIG = {
  ls: ['ls', 'list'],
};

export default async function main(client: Client) {
  let parsedArgs = null;

  const flagsSpecification = getFlagsSpecification(targetCommand.options);

  // Parse CLI args
  try {
    parsedArgs = parseArguments(client.argv.slice(2), flagsSpecification);
  } catch (error) {
    handleError(error);
    return 1;
  }

  const { output, telemetryEventStore } = client;
  const telemetry = new TargetTelemetryClient({
    opts: {
      output: output,
      store: telemetryEventStore,
    },
  });

  if (parsedArgs.flags['--help']) {
    output.print(help(targetCommand, { columns: client.stderr.columns }));
    return 2;
  }

  parsedArgs.args = parsedArgs.args.slice(1);
  const subcommand = parsedArgs.args[0];
  const args = parsedArgs.args.slice(1);

  switch (subcommand) {
    case 'ls':
    case 'list':
      telemetry.trackCliSubcommandList(subcommand);
      return await list(client, args);
    default:
      output.error(getInvalidSubcommand(COMMAND_CONFIG));
      client.output.print(
        help(targetCommand, { columns: client.stderr.columns })
      );
      return 2;
  }
}
