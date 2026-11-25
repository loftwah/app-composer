# Prints Desktop integration

Prints Desktop runs independently of App Composer. The workshop and shared navigation are ordinary public links. They work signed out, including when the optional plugin is absent.

Composer operators can include the Prints admin plugin at build time with `APP_COMPOSER_PRINTS_PLUGIN=1`. It adds a Prints Desktop entry under Plugins and exposes the public download, workshop and statistics links to administrators with `plugins:manage`. Remove the flag and redeploy to remove the plugin. The default Composer build omits it.

The plugin has no account-linking flow, credential storage, content writes, background process or desktop runtime dependency. Connected image jobs stay with the creator's Oyster, Prints and Darkroom installation. A native publishing capability would need a separately reviewed, user-initiated authorization and destination contract.
