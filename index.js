const DymoServices = require('./src/dymo-serices');
const imageServices = require('./src/image-services');

// Example print command.
(async function () {

    const dymoServices = new DymoServices();

    const {imageWidth, imageHeight} = dymoServices.DYMO_LABELS[1];
    const image = await imageServices.createImageWithText(imageWidth, imageHeight, 50, 128, 'Hello World!');

    image.write(__dirname + '/image.png');

    // Rotate image for label writer.
    image.rotate(-90, true);
    const bitmap = await imageServices.convertImageToBitmap(image);

    dymoServices.print(bitmap)
    // dymoServices.listPrinters()
        .then(result => {
            console.log('Successfully printed: ' + JSON.stringify(result, null, 2));
        })
        .catch(error => {
            console.error('Error: ' + error);
        });
})();


// const config = {
    // interface: 'NETWORK',
    // host: '169.254.25.51',
    // host: '192.168.1.229',
    // port: 9100
// };
