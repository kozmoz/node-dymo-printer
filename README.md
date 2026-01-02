# node-dymo-printer

A lightweight, zero-dependency Node.js library for DYMO LabelWriter 400/450 series printers. 
Pure JavaScript, cross-platform, and functions without the DYMO SDK or Web Services.

It has been tested to work on Windows 10, macOS (11+) and Ubuntu 21.10.

Developed for the DYMO LabelWriter 450, but might also work for other models.

## Initialize

Prerequisites
- [Node](https://www.nodejs.org) v >= 18
- NPM v >= 6

```shell
npm install node-dymo-printer
```

## Quick Start

The following example finds the printer automatically and prints a standard label.

```Javascript
import { DymoServices, createImageWithText } from 'node-dymo-printer';

// Define label dimensions and create an image
const { imageWidth, imageHeight } = DymoServices.DYMO_LABELS['89mm x 36mm'];
const image = await createImageWithText(imageWidth, imageHeight, 0, 128, 'Hello World!');

// Print (empty config auto-detects the printer)
const printer = new DymoServices({});
await printer.print(image, 1);
```

### Examples

See the demo<n>.js files in the repository for detailed use cases:

1. `demo1.js`: Auto-detect printer and print "Hello world!".
2. `demo2.js`: Connect using specific printer details.
3. `demo3.js`: List all installed printers.
4. `demo4.js`: Load and print an image file.

```Javascript
// Create landscape image with the dimensions of the label and with the text "Hello World!".
const {imageWidth, imageHeight} = DymoServices.DYMO_LABELS['89mm x 36mm'];
const image = await createImageWithText(imageWidth, imageHeight, 0, 128, 'Hello World!');

// Print it, just one label.
// We use an empty config object, so dymoServices tries to find the label printer automagically.
await new DymoServices({}).print(image, 1);
```


### Manual printer configuration

The printer configuration is optional. When initialized with an empty configuration object, it tries to find the DYMO Label Writer. 

For manual configuration, those interfaces are supported: "NETWORK", "CUPS", "WINDOWS" and "DEVICE".

```Javascript
// Network example (Linux, Windows, macOS).
new DymoServices({
    interface: 'NETWORK',
    host: '192.168.1.145',
    port: 9100
});

// USB device example (linux).
new DymoServices({
    interface: 'DEVICE',
    device: '/dev/usb/lp0'
});

// CUPS example (macOS, linux).
new DymoServices({
    interface: 'CUPS',
    deviceId: 'DYMO_LabelWriter_450'
});

// Windows example.
new DymoServices({
    interface: 'WINDOWS',
    deviceId: 'DYMO LabelWriter 450'
});
```

On Linux, to grant access to device <code>/dev/usb/lp0</code>, execute the following command and restart the system:

```
# sudo adduser <username> lp
```

## References and remarks

For image processing, this library makes use of [Jimp](https://github.com/oliver-moran/jimp). An image processing library for Node written entirely in
JavaScript, with zero native dependencies.

For Windows, it uses an executable named `RawPrint.exe` to write directly to a printer bypassing the printer driver. For details about this project,
see [RawPrint](https://github.com/frogmorecs/RawPrint)

The source code to list all printers in Windows, is borrowed from this project: [pdf-to-printer](https://github.com/artiebits/pdf-to-printer)

[DYMO LabelWriter 450 Series Printers Technical Reference Manual](https://download.dymo.com/dymo/technical-data-sheets/LW%20450%20Series%20Technical%20Reference.pdf)
