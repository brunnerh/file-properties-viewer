# File Properties Viewer

This is an extension for [Visual Studio Code](https://code.visualstudio.com/) which adds a command and related context menu entries for displaying file system properties of a given file. It shows file size and timestamps like the creation date.

## Features

The command can be invoked via command palette, keyboard shortcut or from either the tab context menu, or the project explorer file context menu.

A view like this will be opened for the respective file:

![Example output](./readme-files/example.png)

Additional information can be provided by the following applications:

- [`xdg-mime`](https://www.freedesktop.org/wiki/Software/xdg-utils) - Queries the MIME type.
- [`mediainfo`](https://mediaarea.net/en/MediaInfo) - Queries media information of images, audio and video.

If the applications are available in the path, they will be called unless they are explicitly disabled via the settings.

## Extension Settings

This extension contributes the following settings:

- `filePropertiesViewer.dateTimeFormat`: Sets a custom date/time format for the timestamps.
- `filePropertiesViewer.queryMediaInfo`: Whether media information via mediainfo should be requested.
- `filePropertiesViewer.queryMIME`: Whether MIME information via xdg-mime should be requested.
