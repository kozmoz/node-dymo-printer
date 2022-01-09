#Sitedish Order Management

Manage Sitedish orders. See live orders, get notified and manage the delivery times.


## Prerequisites ##

- [Node](http://www.nodejs.org) v >= 6
- NPM v >= 3


### Initialise

First install all required libraries of both the mail app and sub app and build the Angular app.

1. run `npm install`
2run `npm run build`


### Development

Run `npm run serve`

This will start the electron app in development mode
and starts the webpack build in watch develop mode.

To view the changes within the electron app, it needs a refresh (cmd-R).


### Unit Tests

Run `npm test` for a single unit test run for both backend (NodeJS) and frontend (AngularJS).

- Run `npm run test-node` to start only the backend (NodeJS) tests
- Run `npm run test-ng` to start only the frontend (AngularJS) tests
- Run `npm run test-ng-single-run` to start only the frontend for a single run


### Create Distribution

Run `npm run build`

This creates binary packages for MacOS and Linux in the `dist` folder.


## Dependencies

Most dependencies will be obvious, here a list with the less obvious libraries:

    * `unorm`: Used to remove unicode we cannot print, also a requirement of the npm `node-thermal-printer`.     


## Resources for Learning Electron

- [electron.atom.io/docs](http://electron.atom.io/docs) - all of Electron's documentation
