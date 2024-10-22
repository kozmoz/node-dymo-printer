const {DymoServices, loadImage} = require('node-dymo-printer');

/**
 * Try to find the DYMO LabelWriter and print given image (image is sized for a 89mm x 36mm label).
 */

(async function () {

    // Load image to be printed.
    const image = await loadImage(__dirname + '/demo4.png');
    try {
        await new DymoServices().print(image, 1);
        console.log('Successfully printed');
    } catch (e) {
        console.error('Error while trying to print the image: ', e);
    }

})();
