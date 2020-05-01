# Change Log

## [0.4.0] - 2020-05-01

- Added:
  - Display relative time after timestamps.
  - Option for turning off the relative time display (`disableRelativeTimestamps`).
  - Directory path link which should open the folder in the default file manager.
  - Edit button which tries to open the file in VS Code (previously the functionality of the full path link).
  - Tooltips for buttons.
- Changed:
  - Full path link now opens the file with the default application.
  - CSS for styling: Class `copy-button` renamed to `icon-button`, which is used for both edit and copy.
- Fixed:
  - Being unable to use command on user settings file.

## [0.3.4] - 2020-02-03

- Fixed: fs.stat with options argument not working in remote environment due to an outdated polyfill used by vscode-server.

## [0.3.3] - 2019-07-25

- Fixed: fs.stat throwing for undefined options argument.

## [0.3.2] - 2019-03-18

- Fixed:
  - Webview not working on Windows due to different file system path syntax.
  - File link on Windows, also due to path syntax.
  - Tab name showing not only file name on Windows, also due to path syntax.
- Added:
  - Line-break opportunities in paths to allow the table to shrink horizontally.

## [0.3.1] - 2019-03-18

- Switch from deprecated `vscode.previewHtml` command to webview API. (This change should not have any noticeable effect.)

## [0.3.0] - 2019-03-01

- Added:
  - Row for full file path with link to file.
  - Copy button for name, directory and path values.
  - Option for defining a custom table style.
  - Section explaining how to set up Mediainfo support on Windows.
- Changed:
  - Table style to be less noisy.

## [0.2.0] - 2018-05-26

- Added optional support for:
	- [`xdg-mime`](https://www.freedesktop.org/wiki/Software/xdg-utils) - Queries the MIME type.
	- [`mediainfo`](https://mediaarea.net/en/MediaInfo) - Queries media information of images, audio and video.

## [0.1.0] - 2017-11-30

- Initial release