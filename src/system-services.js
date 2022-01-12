import {spawn} from 'child_process';

/**
 * Execute the given command spawned as new process.
 *
 * @param {string} command Command to execute
 * @param {string[]} [commandArgs] Command arguments.
 * @param {Buffer} [buffer] Buffer to send (optional)
 * @return {Promise<string>}
 */
export function execute(command, commandArgs = [], buffer = undefined) {
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

        const stdout = [];
        const stderr = [];
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
            // noinspection JSUnresolvedVariable
            if (proces.stdin.setEncoding) {
                proces.stdin.setEncoding('binary');
            }
            proces.stdin.write(buffer);
        }
        proces.stdin.end();
    });
}

