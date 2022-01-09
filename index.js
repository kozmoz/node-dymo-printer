const DymoServices = require('./src/dymo-serices');
const imageServices = require('./src/image-services');

const config = {
    // interface: 'NETWORK',
    // host: '169.254.25.51',
    // host: '192.168.1.229',
    // port: 9100
};

const dymoServices = DymoServices(config);


// Dymo 99010 labels S0722370 compatible , 89mm x 28mm (3.5inch x 1.1inch, 300dpi).

const labels = [
    {
        title: '89mm x 28mm',
        imageWidth: 1050,
        imageHeight: 330
    },
    {
        title: '89mm x 36mm',
        imageWidth: 1050,
        imageHeight: 426
    }
];

// Example print command.
(async function () {

    const {imageWidth, imageHeight} = labels[1];

    const image = await imageServices.createImage(imageWidth, imageHeight, 50, 128, 'Hello World!');
    image.write(__dirname + '/image.png');

    // Rotate image for label writer.
    image.rotate(-90, true)
    const bitmap = await imageServices.convertImageToBitmapBuffer(image);

    dymoServices.print(bitmap)
        .then(() => {
            console.log('Successfully printed');
        })
        .catch(error => {
            console.error('Error: ' + error);
        });
})();

