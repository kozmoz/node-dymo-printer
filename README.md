# node-dymo-printer

A library / module to print labels from Node.js. Pure javascript cross-platform with no platform specific dependencies. There is no need to install
the DYMO SDK or DYMO Webservices.

It has been tested to work on Windows 10, macOS Big Sur 11.6 and Ubuntu 21.10.

Developed for the DYMO LabelWriter 450, but might also work for other models.

## Prerequisites ##

- [Node](https://www.nodejs.org) v >= 12
- NPM v >= 6

### Initialize

First install the module `node-dymo-printer`.

`$ npm install node-dymo-printer`

### Demos

1. `demo1.js`: Tries to find the DYMO label printer automatically and prints "Hello world!".
2. `demo2.js`: Similar to the first one, instead that the configuration contains the printer connection details.
3. `demo3.js`: Show a list of all installed printers.
4. `demo4.js`: Load an image and print it as label.

Code excerpt to print a text label. <br />
See the `demo<n>.js` files for all the details.

```Javascript
// Create landscape image with the dimensions of the label and with the text "Hello World!".
const {imageWidth, imageHeight} = DymoServices.DYMO_LABELS[1];
const image = await createImageWithText(imageWidth, imageHeight, 50, 128, 'Hello World!');

// Print it, just one label.
// We use an empty config object, so dymoServices tries to find the label printer automagically.
await new DymoServices({}).print(image, 1);
```   
   
## References and remarks

For image processing, this library makes use of [Jimp](https://github.com/oliver-moran/jimp). An image processing library for Node written entirely in
JavaScript, with zero native dependencies.

For Windows, it uses an executable named `RawPrint.exe` to write directly to a printer bypassing the printer driver. For details about this project,
see [RawPrint](https://github.com/frogmorecs/RawPrint)

The source code to list all printers in Windows, is borrowed from this project: [pdf-to-printer](https://github.com/artiebits/pdf-to-printer)

[DYMO LabelWriter 450 Series Printers Technical Reference Manual](https://download.dymo.com/dymo/technical-data-sheets/LW%20450%20Series%20Technical%20Reference.pdf)

This npm module is compatible with both commonJS and ESM.
[How to Create a Hybrid NPM Module for ESM and CommonJS](https://www.sensedeep.com/blog/posts/2021/how-to-create-single-source-npm-module.html)
