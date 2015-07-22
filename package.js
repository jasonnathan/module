Package.describe({
    name: 'rocket:module',
    version: '0.1.6',
    // Brief, one-line summary of the package.
    summary: 'ES6 Modules for Meteor. (And CJS/AMD too!)',
    // URL to the Git repository containing the source code for this package.
    git: 'https://github.com/meteor-rocket/module.git',
    // By default, Meteor will default to using README.md for documentation.
    // To avoid submitting documentation, set this field to null.
    documentation: 'README.md'
})

Package.registerBuildPlugin({
    name: 'rocket:module',
    use: [
        'meteor',
        'rocket:webpack@1.9.10',
        'rocket:build-tools@1.0.0',
        'ecmascript@0.1.3'
    ],
    sources: ['plugin/plugin.js'],
    npmDependencies: {
        'lodash': '3.8.0',
        'glob': '5.0.5',
        'fs-extra': '0.18.4',
        'async': '1.2.0',
        'regexr': '1.1.1',
        'mkdirp': '0.5.1',
        'npm': '2.13.0',
        'shelljs': '0.5.1'
    }
})

Package.onUse(function(api) {
    //api.versionsFrom('1.1.0.2');

    // needed if using Plugin.registerCompiler (for now?)
    api.use('isobuild:compiler-plugin@1.0.0');

    api.addFiles('shared-modules.js')
    api.export('RocketModule')
})

Package.onTest(function(api) {
    api.use('tinytest')
    api.use('rocket:module')
    api.addFiles('module-tests.js')
})
