const {spawn} = require('child_process');

exports.getPrinters = () => {
    return new Promise((resolve, reject) => {

        // Node’s Child Processes
        // https://jscomplete.com/learn/node-beyond-basics/child-processes
        const proces = spawn("Powershell.exe", [
            "-Command",
            "Get-CimInstance Win32_Printer -Property DeviceID,Name",
        ]);

        let stdout = '';
        proces.on("exit", function (code, signal) {
            if (code === 0) {
                resolve(stdoutHandler(stdout));
                return;
            }
            reject("child process exited with " + `code ${code} and signal ${signal}`);
        });
        proces.on("error", function (code, signal) {
            reject("child process error with " + `code ${code} and signal ${signal}`);
        });
        proces.stdin.on("error", function (error) {
            reject("stdin process error: " + error);
        });

        proces.stdout.on("data", data => {
            console.info(`child stdout: ${data}`);
            stdout += data;
        });

        proces.stderr.on("data", data => {
            reject(`stderr error: \n${data}`);
        });
        proces.stdin.end();
    });
}


function stdoutHandler(stdout) {
    const printers = [];

    stdout
        .split(/(\r?\n){2,}/)
        .map((printer) => printer.trim())
        .filter((printer) => !!printer)
        .forEach((printer) => {
            const {isValid, printerData} = isValidPrinter(printer);

            if (!isValid) return;

            printers.push(printerData);
        });

    return printers;
}

function isValidPrinter(printer) {
    const printerData = {
        deviceId: "",
        name: "",
    };

    const isValid = printer.split(/\r?\n/).some((line) => {
        const [label, value] = line.split(":").map((el) => el.trim());

        const lowerLabel = label.toLowerCase();

        // @ts-ignore
        if (lowerLabel === "deviceid") printerData.deviceId = value;

        // @ts-ignore
        if (lowerLabel === "name") printerData.name = value;

        return !!(printerData.deviceId && printerData.name);
    });

    return {
        isValid,
        printerData,
    };
}

exports.getPrinters()
.then(result => {
    console.log('==== success: ' + JSON.stringify(result, null, 4))
})
    .catch(error => {
    console.log('==== error: ' + error)
})
