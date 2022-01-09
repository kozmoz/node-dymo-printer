async function getPrinters() {
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

    try {
        const {stdout} = await execFileAsync("Powershell.exe", [
            "-Command",
            "Get-CimInstance Win32_Printer -Property DeviceID,Name",
        ]);
        return stdoutHandler(stdout);
    } catch (error) {
        throw error;
    }
}

exports.getPrinters = getPrinters()

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