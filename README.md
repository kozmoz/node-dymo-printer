# node-dymo-printer

A library to print labels from Node.js. Pure javascript cross-platform with no platform specific dependencies. 
There is no need to install the DYMO SDK or DYMO Webservices.

It has been tested to work on Windows 10, macOS Big Sur 11.6 and Ubuntu 21.10.

Developed for the DYMO LabelWriter 450, but might also work for other models.


## Prerequisites ##

- [Node](http://www.nodejs.org) v >= 12
- NPM v >= 6


### Initialize

First install the required libraries.

`$ npm install`


### Demos

The first demo tries to find the label printer and prints "Hello world!"

`$ node demo1.js`


### Unit Tests

`$ npm test`


## References and remarks

For image processing, this library makes use of `jimp`: An image processing library for Node written entirely in JavaScript, with zero native dependencies.

For Windows, it uses an executable named `RawPrint.exe` to write directly to a printer bypassing the printer driver. 
For details about this project, see [RawPrint](https://github.com/frogmorecs/RawPrint) 

The source code to list all printers in Windows, is borrowed from this project: [pdf-to-printer](https://github.com/artiebits/pdf-to-printer)

DYMO LabelWriter 450 Series Printers Technical Reference Manual: https://download.dymo.com/dymo/technical-data-sheets/LW%20450%20Series%20Technical%20Reference.pdf
