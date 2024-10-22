# node-dymo-printer

A library / module to print labels from Node.js. Pure javascript cross-platform with no platform specific dependencies. There is no need to install
the DYMO SDK or DYMO Webservices.

It has been tested to work on Windows 10, macOS (Big Sur 11.6, Monterey 12.1) and Ubuntu 21.10.

Developed for the DYMO LabelWriter 450, but might also work for other models.

## Prerequisites ##

- [Node](https://www.nodejs.org) v >= 12
- NPM v >= 6

### Initialize

**1. Create a new project directory**

Open your terminal (Command Prompt, Git Bash, etc.), and run the following commands:

```shell
mkdir myapp  # Creates a new folder named 'myapp'
cd myapp     # Moves into the new 'myapp' folder
npm init     # Initializes a new Node.js project
````

When prompted, you can hit Enter multiple times to accept the default settings. 
This will create a package.json file that helps manage the project's dependencies. 

**2. Install the node-dymo-printer module**

Once inside the myapp folder, install the necessary module by running:

```shell
npm install node-dymo-printer
```

This will download and add the node-dymo-printer module to your project.

**3. Run a demo script**

Now, you can try running one of the example scripts provided below. For example, after adding the demo1.js file to your project folder (myapp), run:

```shell
node demo1.js
```

### Examples

1. `demo1.js`: Tries to find the DYMO label printer automatically and prints "Hello world!".
2. `demo2.js`: Similar to the first one, instead that the configuration contains the printer connection details.
3. `demo3.js`: Show a list of all installed printers.
4. `demo4.js`: Load an image and print it as label.

Code excerpt to print a text label. <br />
See the `demo<n>.js` files for all the details.

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
    host: '192.168.1.229',
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

This npm module is compatible with both commonJS and ESM.
[How to Create a Hybrid NPM Module for ESM and CommonJS](https://www.sensedeep.com/blog/posts/2021/how-to-create-single-source-npm-module.html)
