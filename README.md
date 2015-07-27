rocket:module
=============

ES6 Modules for Meteor. (And CJS/AMD too!)

**NOTE: This isn't ready yet! It'll be ready at v1.0.0., although it is now in a usable state if you want to help test it out. :)**

Installation
------------

```sh
meteor add rocket:module
```

Roadmap/tasks until first release
---------------------------------

These steps are mostly in the order that they'll be developed. *Semver rules won't
apply until version 1.0.0.*

### v0.2.0 (first usable version)
- [x] Register a new compiler with Plugin.registerCompiler.
- [x] Redo everything but with the files handed to rocket:module by Meteor,
      thus eliminating the two previous month's worth of work. (:

### v1.0.0
- [ ] Add common Webpack loaders: babel, coffeescript, typescript, glslify,
      css, less, sass, and stylus.
- [ ] Use Webpack's caching feature so that only
      modified files are rebuilt. Make sure to write the
      replacement of `window` by `RocketModule` to the built
      files if Webpack's cache reads the built files.
- [ ] Get code splitting working (webpack/webpack issue #1296). Currently each
      entry point is having duplicate code, which is the same as Meteor's
      dependency handling.
- [ ] Handle source maps.
- [ ] Use npm.commands.outdated to detect if we need to run
      npm.commands.update. We'll need to run the update command when dependencies
      listed in npm.json files have changed in order to update the local packages.
- [ ] Test in Windows.
- [ ] Report file-specific Webpack errors using corresponding InputFile.error() calls.
- [ ] Finish commented TODOs that are left in rocket:module.
- [ ] Update README with usage and configuration documentation.
  - [ ] Describe how to use npm dependencies in an app directly, using a spare
        local package (basically like what meteorhacks:npm does).
- [ ] Celebrate! Wooooo!

### v1.x.x (in order of importance)
- [ ] Support npm dependencies for apps that already use meteorhacks:npm.
  - [ ] Detect meteorhacks:npm's local "npm-container" package and install it's
        npm dependencies alongside those of the packages dependent rocket:module.
- [x] Code split for each architecture instead of all at once (each
      architecture may possibly have different shared modules).
