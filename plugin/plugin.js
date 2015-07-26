/**
 * @fileoverview Sets up a Meteor build plugin that compiles entrypoints into
 * bundles. The code of the entrypoints can use module syntax (f.e. ES6, CJS,
 * or AMD). Currently the plugin uses Webpack to compile entrypoints.
 *
 * TODO: Make webpack watch files for changes while in dev mode?
 */

// npm builtin modules
const path                  = Npm.require('path')
const fs                    = Npm.require('fs')
const os                    = Npm.require('os')

// npm modules
const _                     = Npm.require('lodash')
const glob                  = Npm.require('glob')
const fse                   = Npm.require('fs-extra')
const async                 = Npm.require('async')
const regexr                = Npm.require('regexr')
const mkdirp                = Npm.require('mkdirp')
const npm                   = Npm.require('npm')
const shell                 = Npm.require('shelljs')

// Meteor package imports
const webpack               = Package['rocket:webpack'].Webpack
const BuildTools            = Package['rocket:build-tools'].BuildTools

const {
    PLATFORM_NAMES,
    FILENAME_REGEX,
    getAppPath,
    getInstalledPackages,
    isAppBuild,
    getDependentsOf,
    isLocalPackage,
    getPackageInfo,
    toIsopackName,
    toPackageName,
    getPath,
    getMeteorPath,
    getMeteorNpmRequireRoot,
    getCommonAncestorPath,
    requireFromMeteor
} = BuildTools

// modules from Meteor.
const meteorNpm = requireFromMeteor(path.join('tools', 'isobuild', 'meteor-npm'))

let numberOfFilesToHandle = 0
let isFirstRun            = !process.rocketModuleFirstRunComplete

let npmIsLoaded = false

/**
 * RocketModuleCompiler uses Webpack to share dependencies and modules across
 * packages (including the local application which is a special package
 * itself). It also provides a bunch of loader for support of ES6,
 * Coffeescript, CSS, TypeScript, etc.
 *
 * The instance of this class that gets instantiated by Meteor stays alive as
 * long as the Meteor process does (unless rocket:module is a local package and
 * has had a file changed).
 *
 * @class RocketModuleCompiler
 */
class RocketModuleCompiler {

    /**
     * @constructor
     */
    constructor() {

        // if we've just started the `meteor` command, clear the rocket-module cache.
        //if (isFirstRun) {

        //}

        //// Add this to the `process` so we can detect first runs vs re-builds after file
        //// changes.
        //if (!process.rocketModuleFirstRunComplete) {
            //process.rocketModuleFirstRunComplete = true
        //}
    }

    /**
     * processFilesForTarget is executed in parallel, once for each platform.
     *
     * @override
     * @param {Array.InputFile} inputFiles An array of InputFile data types.
     * See Meteor's registerCompiler API for info.
     * @return {undefined}
     */
    processFilesForTarget(inputFiles) {

        let r = regexr
        let { platform } = fileInfo(inputFiles[0])

        /*
         * Choose a temporary output location that doesn't exist yet.
         */
        let platformBatchDir = path.resolve(getAppPath(), '.meteor', 'local', 'rocket-module', platform)
        if (!fs.existsSync(platformBatchDir)) mkdirp.sync(platformBatchDir)

        // the initial webpack configuration object.
        let webpackConfig = {
            entry: {
                // f.e.:
                //'username_packagename/one/one': './packages/username_packagename/one/one',
                //'username_packagename/two/two': './packages/username_packagename/two/two',
            },
            output: {
                path: path.resolve(platformBatchDir, './built'),
                filename: '[name]',
            },
            plugins: [ new webpack.optimize.CommonsChunkPlugin("shared-modules.js") ],
            resolve: {
                fallback: [
                    // f.e.:
                    //path.resolve('./node_modules/username_packagename/node_modules'),
                    //path.resolve('./node_modules/username_packagename/node_modules')
                ]
            },
            module: {
                loaders: [
                    { test: /\.css$/, loader: "style!css" }
                    // TODO: get babel-loader working.
                    //,{ test: /\.js$/, loader: "babel", exclude: /node_modules/ }
                ]
            }
        }

        let mainPackageDotJsonData = {
            dependencies: {}
        }

        /*
         * Write the file sources, and package.json files for npm dependencies,
         * to the platformBatchDir to be handled by Webpack.
         */
        _.each(inputFiles, (inputFile) => {
            let { package, fileName, isopackName, packageFileName, fileSource }
                = fileInfo(inputFile)

            let batchDirPackagePath = path.resolve(platformBatchDir, 'packages', isopackName)

            // make the package path, and other things, in the batch dir
            mkdirp.sync(batchDirPackagePath)

            // write a package.json for the current package, containing npm
            // deps, package isopack name, and version 0.0.0 (version is
            // required by npm).
            //
            // TODO: Write package.json for the app (__app__) if it uses
            // meteorhacks:npm.
            if (package.name) { // if not the app (__app__)
                let dependent = getPackageInfo(package.name) // TODO: Update getPackageInfo for Meteor 1.2, isopack-2 format.
                _.each(dependent.npmDependencies, (version, name) => {
                    dependent.npmDependencies[name] = '^'+version
                })
                fs.writeFileSync(path.resolve(batchDirPackagePath, 'package.json'), `{
                    "name": "${isopackName}",
                    "version": "0.0.0",
                    "dependencies": ${
                        JSON.stringify(dependent.npmDependencies)
                    }
                }`)

                // Specify the current dependent (except for rocket:module)
                // as a dependency in the main package.json
                if (package.name !== 'rocket:module') {
                    mainPackageDotJsonData.dependencies[isopackName] = `file:./packages/${isopackName}`
                }
            }

            // write non-entrypoint files to the platformBatchDir
            // TODO TODO TODO TODO handle other files.
            if (fileName.match(/\.js$/g)
                && !(fileName.match(/shared-modules\.js$/g) && package.name === 'rocket:module')
                && !fileName.match(/module\.js$/g)) {
            }

            // write entrypoint files to the platformBatchDir, add them to
            // webpackConfig's entry option.
            else if (fileName.match(/module\.js$/g)) {

                // Write the module source to the platformBatchDir and list it
                // in webpackConfig's entry option.
                //
                // The Webpack entry path is relative to the platformBatchDir, where
                // webpack will be running from, so the period is needed (we
                // can't use path.join because it removes the leading period):
                let filePath = path.resolve(batchDirPackagePath, fileName)
                mkdirp.sync(getPath(filePath))
                fs.writeFileSync(filePath, fileSource)
                webpackConfig.entry[packageFileName] = '.' +path.sep+ 'packages' +path.sep+ packageFileName
            }

            // Don't write the empty shared-modules file to the batchdir. We'll
            // set it source with the Webpack entry chunk after compilation.
            else if (fileName.match(/shared-modules\.js$/g) && package.name === 'rocket:module') {
                // do nothing.
            }
        })

        // Write the main package.json file.
        let mainPackageDotJson = path.resolve(platformBatchDir, 'package.json')
        fs.writeFileSync(mainPackageDotJson, JSON.stringify(mainPackageDotJsonData))

        /*
         * Install all the packages and their npm dependencies in the platformBatchDir.
         */
        let savedLogFunction = console.log
        console.log = function() {}
        Meteor.wrapAsync((callback) => {
            npm.load({ prefix: platformBatchDir, loglevel: 'silent' }, callback)
        })()
        Meteor.wrapAsync((callback) => {
            npm.commands.install(platformBatchDir, [], callback)
        })()
        console.log = savedLogFunction

        // list each node_modules folder (those installed in the previous
        // step) in webpackConfig's resolve.fallback option.
        _.each(inputFiles, (inputFile) => {
            let { isopackName } = fileInfo(inputFile)
            let nodeModulesPath = path.resolve(platformBatchDir, 'node_modules', isopackName, 'node_modules')

            // TODO: node_modules for the app if meteorhacks:npm is installed.
            if (fs.existsSync(nodeModulesPath))
                webpackConfig.resolve.fallback.push(nodeModulesPath)
        })

        /*
         * Run the Webpack compiler synchronously.
         */
        {
            let oldCwd = process.cwd()
            process.chdir(platformBatchDir)

            // TODO: Find out why Webpack doesn't code split shared modules in this setup.
            // Files an issue on Webpack at https://github.com/webpack/webpack/issues/1296
            let webpackCompiler = webpack(webpackConfig)
            let webpackResult = Meteor.wrapAsync((callback) =>
                webpackCompiler.run((error, stats) => {

                    // TODO: Meteor doesn't catch this error.
                    // It would be nice to put Meteor into an error state,
                    // showing this error, so the user can fix what's broken
                    // here.
                    //
                    // Maybe we can detect which file had the error, then get the
                    // corresponding InputFile and call the .error method on it?
                    if (error) throw new Error(error)

                    callback(error, stats)
                })
            )()

            process.chdir(oldCwd)
        }

        /*
         * Pass all the compiled files back into their corresponding InputFiles
         * via the addJavaScript method.
         */
        _.each(inputFiles, (inputFile) => {
            let { fileName, package, isopackName } = fileInfo(inputFile)

            let batchDirBuiltPackagePath = path.resolve(platformBatchDir, 'built', isopackName)
            let batchDirBuiltFilePath = path.resolve(batchDirBuiltPackagePath, fileName)

            let builtFileSource

            // TODO TODO TODO TODO handle other files.
            if (fileName.match(/shared-modules\.js$/g) && package.name === 'rocket:module') {
                builtFileSource = fs.readFileSync(
                    path.resolve(platformBatchDir, 'built', 'shared-modules.js')
                ).toString()

                // replace window with RocketModule on the server-side, which
                // is shared with all packages that depend on rocket:module.
                // Webpack adds things to window in web builds, but we don't
                // have window on the server-side. Luckily we know all packages
                // being processed by this compiler all depend on
                // rocket:module, so they can all access the RocketModule
                // symbol similarly to a global like window.
                if (platform.match(/^os/g)) {
                    builtFileSource = 'RocketModule = {};\n'+builtFileSource
                    builtFileSource = builtFileSource.replace(/\bwindow\b/g, 'RocketModule')
                }
            }
            else if (fileName.match(/module\.js$/g)) {
                builtFileSource = fs.readFileSync(batchDirBuiltFilePath).toString()

                // add the RocketModule symbol to the entry points so that they
                // can read the stuff that Webpack added to RocketModule in the
                // shared-modules.js file.
                if (platform === 'os') {
                    // extend function from http://stackoverflow.com/a/12317051/454780
                    builtFileSource = (`
                        function rocketModuleExtend(target, source) {
                            target = target || {};
                            for (var prop in source) {
                                if (typeof source[prop] === 'object') {
                                    target[prop] = rocketModuleExtend(target[prop], source[prop]);
                                } else {
                                    target[prop] = source[prop];
                                }
                            }
                            return target;
                        }
                        rocketModuleExtend(this, Package['rocket:module'].RocketModule);
                        ${builtFileSource}
                    `)
                }
            }

            // finally add the sources back!
            inputFile.addJavaScript({
                path: fileName,

                // empty strings for files other than entrypoints and
                // shared-modules.js (since they are compiled into the
                // entrypoints, with shared modules put into
                // shared-modules.js).
                data: builtFileSource || '',

                sourcePath: [package.name, fileName].join('/'),
                sourceMap: null // TODO TODO TODO
            })
        })
    }
}

/**
 * @return {boolean} Returns truthy if rocket:module is explicitly installed in the current app.
 */
function appUsesRocketModule() {
    return _.contains(getInstalledPackages(true), "rocket:module")
}

/*
 * See http://stackoverflow.com/questions/3446170/escape-string-for-use-in-javascript-regex
 * TODO: move this to regexr
 */
function escapeRegExp(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

/**
 * Gets the file info that rocket:module needs from the InputFile data type
 * passed to rocket:module in processFilesForTarget().
 *
 * @param {InputFile} inputFile An InputFile object.
 * @return {Object} An object containing the info rocket:module needs.
 */
function fileInfo(inputFile) {

    let unibuild = inputFile._resourceSlot.packageSourceBatch.unibuild
    let inputResource = inputFile._resourceSlot.inputResource

    let package = unibuild.pkg
    let fileName = inputResource.path
    // the isopackName of the current file's package, or __app__ if the
    // file belongs to the app.
    let isopackName = package.name ? toIsopackName(package.name) : '__app__'
    let packageFileName = path.join(isopackName, fileName)

    let fileSource = inputResource.data.toString()
    let extension = inputResource.extension

    let platform = unibuild.arch

    return {
        package, fileName, isopackName, packageFileName, fileSource,
        extension, platform
    }
}

// entrypoint
{
    Plugin.registerCompiler({
        // TODO: Add css, typescript, coffeescript, etc.
        extensions: [ 'js' ]
    }, () => new RocketModuleCompiler)
}
