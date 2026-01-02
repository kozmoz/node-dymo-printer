import {spawn} from 'child_process';

/**
 * Execute the given command spawned as a new process.
 *
 * @param command Command to execute
 * @param [commandArgs] Command arguments.
 * @param [buffer] Buffer to send (optional)
 */
export function execute(command: string, commandArgs: string[] = [], buffer: Buffer | undefined = undefined): Promise<string> {
    return new Promise((resolve, reject) => {

        if (!command) {
            throw Error('"Command" is required');
        }
        if (!Array.isArray(commandArgs)) {
            throw Error('"CommandArgs" should be an array of strings');
        }

        // Node’s Child Processes
        // https://jscomplete.com/learn/node-beyond-basics/child-processes
        const proces = spawn(command, commandArgs);

        const stdout: string[] = [];
        const stderr: string[] = [];
        proces.on('exit', function (code) {
            if (code === 0) {
                if (stderr.length > 0) {
                    console.warn(`Process exited successfully, but wrote to error console: ${stderr.join('')}`);
                }
                resolve(stdout.join(''));
                return;
            }
            reject(`child process exited with code ${code}: \n${stderr.join('')}\n${stdout.join('')}`);
        });
        proces.on('error', function (code, signal) {
            reject(`child process error with code ${code} and signal ${signal}`);
        });
        proces.stdin.on('error', error => {
            reject(`stdin process error: ${error}`);
        });

        proces.stdout.on('data', data => stdout.push(data));
        proces.stderr.on('data', data => stderr.push(data));

        if (buffer) {
            if ((proces.stdin as any).setEncoding) {
                (proces.stdin as any).setEncoding('binary');
            }
            proces.stdin.write(buffer);
        }
        proces.stdin.end();
    });
}

